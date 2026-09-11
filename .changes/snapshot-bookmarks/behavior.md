# Snapshot bookmarks Behavior

### Background:
- Given the Tenant user `vic` is logged in with a session cookie and holds API token `T`
- And the test bindings set `CF_ACCOUNT_ID` to `acc` and `CF_BROWSER_TOKEN` to `tok`
- And `RENDER` is `https://api.cloudflare.com/client/v4/accounts/acc/browser-rendering/content`
- And a Bookmark `B` with url `https://example.com/a` exists

## Feature: Take a snapshot from the list

#### Scenario: The list item offers a Snapshot button
- When GET `/bookmarks`
- Then the item for `B` contains a button whose `data-on:click` posts to `/bookmarks/<B.id>/snapshot`

#### Scenario: A snapshot renders the page and stores it
- Given POST `RENDER` answers 200 with JSON `{"success": true, "result": "<html><head><title>A</title></head><body>kept</body></html>"}`
- When POST `/bookmarks/<B.id>/snapshot` with the `Datastar-Request: true` header
- Then the request to `RENDER` carried `Authorization: Bearer tok` and JSON body `{"url": "https://example.com/a"}`
- And the response is 200 `text/event-stream` containing `event: datastar-patch-elements` and an element with id `bookmark-<B.id>`
- And that element's date link points to `/assets/<A.id>` where `A` is the new Asset
- And GET `/assets/<A.id>` answers 200 with body containing `kept`

#### Scenario: The date links to the latest completed snapshot
- Given `B` has a completed Snapshot `A`
- When GET `/bookmarks`
- Then the date link of `B` points to `/assets/<A.id>`
- And the item contains a link to `/bookmarks/<B.id>/edit#snapshots` with text `1 snapshot`

#### Scenario: A failed render is recorded as failure
- Given POST `RENDER` answers 500 with JSON `{"success": false, "errors": [{"message": "boom"}]}`
- When POST `/bookmarks/<B.id>/snapshot` with the `Datastar-Request: true` header
- Then the response is 200 `text/event-stream` and the patched item contains `Snapshot failed`
- And GET `/api/bookmarks/<B.id>/assets/` with token `T` lists one Asset with `status` `failure`
- And the date link of `B` still points to the Web Archive link

#### Scenario: An unreachable renderer is recorded as failure
- Given no handler matches `RENDER` so the request fails
- When POST `/bookmarks/<B.id>/snapshot` with the `Datastar-Request: true` header
- Then the patched item contains `Snapshot failed`
- And the Asset has `status` `failure`

#### Scenario: A second snapshot within ten seconds is refused
- Given a Snapshot of `B` was taken five seconds ago
- And no handler matches `RENDER`
- When POST `/bookmarks/<B.id>/snapshot` with the `Datastar-Request: true` header
- Then the response is 200 `text/event-stream` and the patched item contains `Wait ten seconds between snapshots`
- And GET `/api/bookmarks/<B.id>/assets/` still lists one Asset

#### Scenario: After ten seconds a new snapshot becomes the latest
- Given a Snapshot `A1` of `B` was taken eleven seconds ago
- And POST `RENDER` answers 200 with JSON `{"success": true, "result": "<html>second</html>"}`
- When POST `/bookmarks/<B.id>/snapshot` with the `Datastar-Request: true` header
- Then a second Asset `A2` exists with `status` `complete`
- And the date link of `B` points to `/assets/<A2.id>`

#### Scenario: Snapshot without the Datastar header returns to the list
- Given POST `RENDER` answers 200 with a successful render
- When POST `/bookmarks/<B.id>/snapshot` as a plain form post
- Then the response redirects to `/bookmarks`
- And `B` has one completed Snapshot

## Feature: View and delete snapshots

### Background:
- Given `B` has a completed Snapshot `A` whose stored HTML is `<html><body>kept</body></html>`

#### Scenario: A snapshot is served sandboxed
- When GET `/assets/<A.id>` with the session cookie
- Then the response is 200 with `Content-Type` `text/html; charset=utf-8`
- And the header `Content-Security-Policy` is `sandbox`
- And the header `X-Content-Type-Options` is `nosniff`
- And the body is `<html><body>kept</body></html>`

#### Scenario: Viewing needs a session
- When GET `/assets/<A.id>` without a cookie
- Then the response redirects to `/login?next=/assets/<A.id>`

#### Scenario: Unknown asset
- When GET `/assets/999`
- Then the response is 404

#### Scenario: The edit page lists snapshots
- When GET `/bookmarks/<B.id>/edit`
- Then the page contains a section with id `snapshots`
- And that section contains a link to `/assets/<A.id>`, the text `complete`, and a form posting to `/assets/<A.id>/delete`

#### Scenario: Deleting from the edit page removes the row and the file
- When POST `/assets/<A.id>/delete` with the session cookie
- Then the response redirects to `/bookmarks/<B.id>/edit`
- And GET `/assets/<A.id>` answers 404
- And GET `/api/bookmarks/<B.id>/assets/` with token `T` has `count` 0
- And the date link of `B` on `/bookmarks` points to the Web Archive link

#### Scenario: Deleting the newest snapshot falls back to the previous one
- Given `B` also has an older completed Snapshot `A0`
- When POST `/assets/<A.id>/delete`
- Then the date link of `B` on `/bookmarks` points to `/assets/<A0.id>`

#### Scenario: Deleting a bookmark removes its snapshots
- When DELETE `/api/bookmarks/<B.id>/` with token `T`
- Then the response is 204
- And GET `/assets/<A.id>` answers 404

## Feature: Assets API

### Background:
- Given `B` has a completed Snapshot `A` with stored HTML `<html>kept</html>`
- And every request carries `Authorization: Token T`

#### Scenario: List assets
- When GET `/api/bookmarks/<B.id>/assets/`
- Then the response is 200 with `count` 1
- And the only result has exactly the keys `id`, `bookmark`, `asset_type`, `date_created`, `content_type`, `display_name`, `status`
- And `bookmark` is `B.id`, `asset_type` is `snapshot`, `content_type` is `text/html`, `status` is `complete`
- And `display_name` starts with `HTML snapshot from `

#### Scenario: Get one asset
- When GET `/api/bookmarks/<B.id>/assets/<A.id>/`
- Then the response is 200 with the same body as the list entry

#### Scenario: Download sends the file as an attachment
- When GET `/api/bookmarks/<B.id>/assets/<A.id>/download/`
- Then the response is 200 with `Content-Type` `text/html; charset=utf-8`
- And `Content-Disposition` starts with `attachment; filename=`
- And the body is `<html>kept</html>`

#### Scenario: Delete an asset
- When DELETE `/api/bookmarks/<B.id>/assets/<A.id>/`
- Then the response is 204
- And GET `/api/bookmarks/<B.id>/assets/` has `count` 0

#### Scenario: Upload is not supported
- When POST `/api/bookmarks/<B.id>/assets/upload/` with multipart form data containing a `file` part
- Then the response is 405 with JSON `{"detail": "Method \"POST\" not allowed."}`

#### Scenario Outline: Unknown ids
- When `<method>` `<path>`
- Then the response is 404

Examples:
| method | path                                  |
| GET    | /api/bookmarks/999/assets/            |
| GET    | /api/bookmarks/<B.id>/assets/999/     |
| GET    | /api/bookmarks/<B.id>/assets/999/download/ |
| DELETE | /api/bookmarks/<B.id>/assets/999/     |

#### Scenario: Token required
- When GET `/api/bookmarks/<B.id>/assets/` without an `Authorization` header
- Then the response is 401

## Feature: Creation flag from the extension

#### Scenario: disable_html_snapshot is accepted and ignored
- When POST `/api/bookmarks/?disable_scraping&disable_html_snapshot` with token `T` and url `https://example.com/z`
- Then the response is 201
- And GET `/api/bookmarks/<new id>/assets/` has `count` 0
