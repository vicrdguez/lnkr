# Add and edit bookmarks in the UI Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in with cookie `C`
- And every request carries `C` and form posts carry `Origin: https://lnkr.test`
- And Datastar action requests carry `Datastar-Request: true` and their signals in the `datastar` query parameter

## Feature: New bookmark form

#### Scenario: The form renders empty
- When GET `/bookmarks/new`
- Then the response is 200 with a form posting to `/bookmarks/new` with inputs `url`, `title`, `description`, `notes`, `tags`, a checkbox `unread` unchecked, and no `auto_close` field
- And the page loads `/static/datastar.js`
- And the form carries a `data-signals` attribute with `url`, `title`, `description`, `notes`, `tags` as empty strings and `unread` false

#### Scenario: The form is prefilled from query parameters
- When GET `/bookmarks/new?url=https://example.com/x&title=X&description=Desc&notes=N&tags=a+b&auto_close`
- Then the inputs hold `https://example.com/x`, `X`, `Desc`, `N`, `a b`
- And a hidden input `auto_close` is present
- And the form's `data-signals` hold the same values

#### Scenario: Saving creates the bookmark
- When POST `/bookmarks/new` with url `https://example.com/x`, title `X`, description `Desc`, notes `N`, tags `a b`, unread `on`
- Then the response redirects to `/bookmarks`
- And GET `/api/bookmarks/` shows one bookmark with url `https://example.com/x`, title `X`, description `Desc`, notes `N`, `tag_names` `["a", "b"]`, `unread` true

#### Scenario: Saving with auto_close ends on the close page
- When POST `/bookmarks/new` with url `https://example.com/x` and `auto_close` `1`
- Then the response redirects to `/bookmarks/close`
- And GET `/bookmarks/close` answers 200 containing `You can now close this window` and `window.close()`

#### Scenario: Saving an existing URL updates it
- Given a bookmark `https://example.com/x` titled `Old` tagged `old`
- When POST `/bookmarks/new` with url `https://example.com/x`, title `New`, tags `new`
- Then the response redirects to `/bookmarks`
- And GET `/api/bookmarks/` has `count` 1 and the bookmark has title `New` and `tag_names` `["new"]`

#### Scenario Outline: Invalid URLs are refused
- When POST `/bookmarks/new` with url `<url>`
- Then the response is 400 and contains the form and `Enter a valid URL`
- And GET `/api/bookmarks/` has `count` 0

Examples:
| url          |
| ``           |
| `nope`       |
| `ftp://x.y/` |

## Feature: URL check

#### Scenario: Existing URL fills the form and shows the notice
- Given a bookmark `https://example.com/x` with id `7`, title `X`, description `D`, notes `N`, tags `a` and `b`, unread
- When GET `/bookmarks/check` with signals `{"url": "https://example.com/x", "title": "", "description": "", "notes": "", "tags": "", "unread": false}`
- Then the response is 200 with `Content-Type` `text/event-stream`
- And it contains a `datastar-patch-elements` event whose elements include `<div id="url-hint"` with the text `This URL is already bookmarked` and a link to `/bookmarks/7/edit`
- And it contains a `datastar-patch-signals` event with `title` `X`, `description` `D`, `notes` `N`, `tags` `a b`, `unread` true

#### Scenario: New URL fills empty fields from the page
- Given the page `https://example.com/new` serves `<title>Page title</title><meta name="description" content="Page desc">`
- When GET `/bookmarks/check` with signals `{"url": "https://example.com/new", "title": "", "description": "Mine", "notes": "", "tags": "", "unread": false}`
- Then the response contains a `datastar-patch-elements` event whose `<div id="url-hint">` is empty
- And a `datastar-patch-signals` event with `title` `Page title` and no `description` key

#### Scenario: Unreachable page patches nothing but the hint
- Given fetching `https://example.com/down` fails
- When GET `/bookmarks/check` with signals for url `https://example.com/down` and empty fields
- Then the response contains an empty `#url-hint` patch and no `datastar-patch-signals` event

#### Scenario: Invalid URL patches only an empty hint
- When GET `/bookmarks/check` with signals for url `nope`
- Then the response contains an empty `#url-hint` patch and no `datastar-patch-signals` event
- And no outbound request was made

#### Scenario: The check needs the Datastar header
- When GET `/bookmarks/check?datastar=%7B%22url%22%3A%22https%3A%2F%2Fexample.com%2F%22%7D` without `Datastar-Request`
- Then the response is 400

## Feature: Tag suggestions

### Background:
- Given tags `python`, `pytest`, `rust` and `Pyramid` exist

#### Scenario: Suggestions match the last token
- When GET `/bookmarks/tags/suggest` with signals `{"tags": "rust py"}`
- Then the response contains a `datastar-patch-elements` event with `<div id="tag-suggestions"` listing `Pyramid`, `pytest`, `python` and not `rust`

#### Scenario: Already typed names are excluded
- When GET `/bookmarks/tags/suggest` with signals `{"tags": "python py"}`
- Then the suggestions list `Pyramid` and `pytest` and not `python`

#### Scenario: An empty last token suggests nothing
- When GET `/bookmarks/tags/suggest` with signals `{"tags": "python "}`
- Then the `#tag-suggestions` patch is empty

#### Scenario: Suggestions cap at ten
- Given twelve more tags `t01` to `t12`
- When GET `/bookmarks/tags/suggest` with signals `{"tags": "t"}`
- Then the suggestions list exactly ten names

#### Scenario: Picking a suggestion completes the token
- When GET `/bookmarks/tags/suggest` with signals `{"tags": "rust py"}`
- Then each suggestion is a button whose `data-on:click` sets `$tags` to the typed text with the last token replaced, for example `rust python `

## Feature: Edit bookmark

### Background:
- Given a bookmark `https://example.com/x` with id `7`, title `X`, notes `N`, tags `a` and `b`, unread
- And another bookmark `https://example.com/y` with id `8`

#### Scenario: The edit form is prefilled
- When GET `/bookmarks/7/edit`
- Then the form posts to `/bookmarks/7/edit` and holds `https://example.com/x`, `X`, `N`, `a b`, with `unread` checked

#### Scenario: Saving updates the bookmark
- When POST `/bookmarks/7/edit` with url `https://example.com/x`, title `X2`, description `D2`, notes ``, tags `c`, no `unread`
- Then the response redirects to `/bookmarks`
- And GET `/api/bookmarks/7/` has title `X2`, description `D2`, notes ``, `tag_names` `["c"]`, `unread` false, and a later `date_modified`

#### Scenario: Changing the URL onto another bookmark is refused
- When POST `/bookmarks/7/edit` with url `https://example.com/y` and title `X`
- Then the response is 400 and contains `A bookmark with this URL already exists`
- And GET `/api/bookmarks/7/` still has url `https://example.com/x`

#### Scenario: Unknown bookmark
- When GET `/bookmarks/999/edit`
- Then the response is 404

## Feature: Entry points

#### Scenario: Bookmarklet on the settings page
- When GET `/settings`
- Then the page contains a link whose `href` starts with `javascript:` and contains `https://lnkr.test/bookmarks/new?url=`, `encodeURIComponent(location.href)`, `document.title` and `auto_close`

#### Scenario: Links from the list
- Given a bookmark with id `7`
- When GET `/bookmarks`
- Then the nav contains a link `Add bookmark` to `/bookmarks/new`
- And the item contains a link `Edit` to `/bookmarks/7/edit`

#### Scenario: Forms need a session
- Given no cookie
- When GET `/bookmarks/new`
- Then the response redirects to `/login?next=%2Fbookmarks%2Fnew`
