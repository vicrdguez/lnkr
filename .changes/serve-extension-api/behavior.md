# Serve the browser extension API Behavior

### Background:
- Given the Tenant user `vic` exists
- And `T` is the API token shown on the settings page
- And every API request below carries `Authorization: Token T` unless stated otherwise

## Feature: API token on the settings page

#### Scenario: A token is created on first view
- Given no API token exists
- When the logged-in user requests GET `/settings`
- Then the page contains a 40-character hexadecimal token
- And GET `/api/user/profile/` with that token answers 200

#### Scenario: Regenerate replaces the token
- Given the settings page showed token `T`
- When the logged-in user submits POST `/settings/token/regenerate`
- Then the settings page shows a different token `T2`
- And GET `/api/user/profile/` with `T2` answers 200
- But GET `/api/user/profile/` with `T` answers 401

## Feature: API authentication

#### Scenario: Missing token
- When GET `/api/bookmarks/` without an `Authorization` header
- Then the response is 401 with JSON `{"detail": "Authentication credentials were not provided."}`

#### Scenario: Unknown token
- When GET `/api/bookmarks/` with `Authorization: Token 0000000000000000000000000000000000000000`
- Then the response is 401 with JSON `{"detail": "Invalid token."}`

#### Scenario: Session cookies do not authenticate the API
- Given a valid `sessionid` cookie and no token
- When GET `/api/bookmarks/`
- Then the response is 401

## Feature: Create bookmarks

#### Scenario: Create with every field
- When POST `/api/bookmarks/` with JSON
  ```
  {"url": "https://example.com/a", "title": "A", "description": "About A", "notes": "n", "is_archived": false, "unread": true, "shared": false, "tag_names": ["Alpha", "beta"]}
  ```
- Then the response is 201
- And the body has exactly the keys `id`, `url`, `title`, `description`, `notes`, `web_archive_snapshot_url`, `favicon_url`, `preview_image_url`, `is_archived`, `unread`, `shared`, `tag_names`, `date_added`, `date_modified`
- And `tag_names` is `["Alpha", "beta"]`, `favicon_url` and `preview_image_url` are null, `web_archive_snapshot_url` is an empty string
- And `date_added` and `date_modified` match `YYYY-MM-DDTHH:MM:SS.sssZ`
- And GET `/api/tags/` lists `Alpha` and `beta`

#### Scenario: Tag names are trimmed and deduplicated regardless of case
- When POST `/api/bookmarks/` with `tag_names` `[" go ", "Go", "rust"]`
- Then the created bookmark's `tag_names` is `["go", "rust"]`
- And GET `/api/tags/` lists exactly two tags

#### Scenario: Existing URL updates instead of duplicating
- Given a bookmark with id `1` and url `https://example.com/a` and title `A`
- When POST `/api/bookmarks/` with url `https://example.com/a` and title `A2`
- Then the response is 201 with `id` `1` and `title` `A2`
- And GET `/api/bookmarks/` has `count` 1

#### Scenario: Empty title and description are filled from the page
- Given the page `https://example.com/p` serves `<title>Page P</title><meta name="description" content="Desc P">`
- When POST `/api/bookmarks/` with url `https://example.com/p` and no title or description
- Then the response is 201 with `title` `Page P` and `description` `Desc P`

#### Scenario: Provided fields are not overwritten by the page
- Given the page `https://example.com/p` serves `<title>Page P</title>`
- When POST `/api/bookmarks/` with url `https://example.com/p` and title `Mine`
- Then the response is 201 with `title` `Mine`

#### Scenario: disable_scraping skips the page fetch
- Given no page is reachable
- When POST `/api/bookmarks/?disable_scraping` with url `https://example.com/q` and no title
- Then the response is 201 with `title` empty
- And no outbound request was made

#### Scenario: Unreachable page leaves fields empty
- Given fetching `https://example.com/down` fails
- When POST `/api/bookmarks/` with url `https://example.com/down` and no title
- Then the response is 201 with `title` empty and `description` empty

#### Scenario Outline: Invalid URLs are refused
- When POST `/api/bookmarks/` with url `<url>`
- Then the response is 400 with JSON `{"url": ["Enter a valid URL."]}`
- And GET `/api/bookmarks/` has `count` 0

Examples:
| url                 |
| ``                  |
| `not a url`         |
| `ftp://example.com` |
| `javascript:alert(1)` |

## Feature: List bookmarks

### Background:
- Given bookmarks created in order: `https://example.com/1` (archived), `https://example.com/2`, `https://example.com/3`

#### Scenario: Active list excludes archived, newest first
- When GET `/api/bookmarks/`
- Then `count` is 2 and `results` urls are `[".../3", ".../2"]`
- And `next` and `previous` are null

#### Scenario: Archived list contains only archived
- When GET `/api/bookmarks/archived/`
- Then `count` is 1 and the only result url is `https://example.com/1`

#### Scenario: Limit and offset paginate with absolute links
- When GET `/api/bookmarks/?limit=1`
- Then `results` has one item, `count` is 2, `next` is `https://<host>/api/bookmarks/?limit=1&offset=1`, `previous` is null
- When GET `/api/bookmarks/?limit=1&offset=1`
- Then `next` is null and `previous` is `https://<host>/api/bookmarks/?limit=1`

#### Scenario: modified_since filters by modification time
- Given `https://example.com/2` was modified at `2026-09-11T10:00:00.000Z` and `https://example.com/3` at `2026-09-11T12:00:00.000Z`
- When GET `/api/bookmarks/?modified_since=2026-09-11T11:00:00Z`
- Then the only result url is `https://example.com/3`

#### Scenario: added_since filters by creation time
- Given `https://example.com/2` was added at `2026-09-11T10:00:00.000Z` and `https://example.com/3` at `2026-09-11T12:00:00.000Z`
- When GET `/api/bookmarks/?added_since=2026-09-11T11:00:00Z`
- Then the only result url is `https://example.com/3`

## Feature: Read, update and delete a bookmark

### Background:
- Given a bookmark `B` with url `https://example.com/a`, title `A`, notes `n`, tags `["x"]`, `unread` true

#### Scenario: Get by id
- When GET `/api/bookmarks/<B.id>/`
- Then the response is 200 with the same body as the creation response

#### Scenario: Unknown id
- When GET `/api/bookmarks/999/`
- Then the response is 404 with JSON `{"detail": "Not found."}`

#### Scenario: PUT replaces and resets omitted fields
- When PUT `/api/bookmarks/<B.id>/` with JSON `{"url": "https://example.com/a", "title": "A3"}`
- Then the response is 200 with `title` `A3`, `notes` empty, `tag_names` `[]`, `unread` false
- And `date_modified` is later than before

#### Scenario: PATCH changes only given fields
- When PATCH `/api/bookmarks/<B.id>/` with JSON `{"notes": "n2"}`
- Then the response is 200 with `notes` `n2`, `title` `A`, `tag_names` `["x"]`, `unread` true

#### Scenario: PUT requires a url
- When PUT `/api/bookmarks/<B.id>/` with JSON `{"title": "A3"}`
- Then the response is 400 with JSON `{"url": ["This field is required."]}`

#### Scenario: Changing the url onto another bookmark is refused
- Given another bookmark with url `https://example.com/b`
- When PATCH `/api/bookmarks/<B.id>/` with JSON `{"url": "https://example.com/b"}`
- Then the response is 400 with a `url` error
- And GET `/api/bookmarks/<B.id>/` still has url `https://example.com/a`

#### Scenario: Delete
- When DELETE `/api/bookmarks/<B.id>/`
- Then the response is 204
- And GET `/api/bookmarks/<B.id>/` answers 404

#### Scenario: Archive and unarchive
- When POST `/api/bookmarks/<B.id>/archive/`
- Then the response is 204 and GET `/api/bookmarks/<B.id>/` has `is_archived` true
- When POST `/api/bookmarks/<B.id>/unarchive/`
- Then the response is 204 and GET `/api/bookmarks/<B.id>/` has `is_archived` false

#### Scenario Outline: Actions on unknown ids
- When `<method>` `/api/bookmarks/999/<suffix>`
- Then the response is 404

Examples:
| method | suffix     |
| DELETE | ``         |
| POST   | archive/   |
| POST   | unarchive/ |
| PATCH  | ``         |

## Feature: Check a URL

#### Scenario: Known URL
- Given a bookmark with url `https://example.com/a`
- When GET `/api/bookmarks/check/?url=https://example.com/a`
- Then `bookmark` is that bookmark's JSON and `auto_tags` is `[]`

#### Scenario: Unknown URL with reachable page
- Given the page `https://example.com/new` serves `<title>New</title><meta property="og:description" content="OG desc">`
- When GET `/api/bookmarks/check/?url=https://example.com/new`
- Then `bookmark` is null, `metadata.title` is `New`, `metadata.description` is `OG desc`, `auto_tags` is `[]`

#### Scenario: Unreachable page
- Given fetching `https://example.com/down` fails
- When GET `/api/bookmarks/check/?url=https://example.com/down`
- Then `bookmark` is null, `metadata.title` is null and `metadata.description` is null

#### Scenario: og:title is a fallback, not an override
- Given the page serves `<title>Real</title><meta property="og:title" content="OG">`
- When GET `/api/bookmarks/check/?url=<that page>`
- Then `metadata.title` is `Real`

#### Scenario: Missing url parameter
- When GET `/api/bookmarks/check/`
- Then the response is 400

## Feature: Tags

#### Scenario: List, create, get
- When POST `/api/tags/` with JSON `{"name": "docs"}`
- Then the response is 201 with keys `id`, `name`, `date_added`
- And GET `/api/tags/` has `count` 1 and GET `/api/tags/<id>/` returns the same tag

#### Scenario: Creating an existing name returns the existing tag
- Given the tag `docs` exists with id `5`
- When POST `/api/tags/` with JSON `{"name": "Docs"}`
- Then the response is 201 with `id` `5` and `name` `docs`

#### Scenario: Deleting a tag removes it from bookmarks
- Given a bookmark tagged `docs` and `x`
- When DELETE `/api/tags/<docs.id>/`
- Then the response is 204
- And the bookmark's `tag_names` is `["x"]`

## Feature: User profile

#### Scenario: Profile fields
- When GET `/api/user/profile/`
- Then the body is
  ```
  {"theme": "auto", "bookmark_date_display": "relative", "bookmark_link_target": "_blank", "web_archive_integration": "disabled", "tag_search": "strict", "enable_sharing": false, "enable_public_sharing": false, "enable_favicons": false, "display_url": false, "permanent_notes": false, "search_preferences": {"sort": "added_desc", "shared": "off", "unread": "off"}, "version": "<package version>"}
  ```
