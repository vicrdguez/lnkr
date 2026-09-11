# Act on bookmarks from the list Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in with cookie `C`
- And action requests are POSTs with `Datastar-Request: true`, `Content-Type: application/json`, cookie `C`, and a JSON body of signals that includes `q`, `sort`, `unread` and `page` unless stated otherwise
- And bookmarks `https://example.com/1` titled `One` unread, `https://example.com/2` titled `Two`, `https://example.com/3` titled `Three` archived, with ids 1, 2 and 3

## Feature: Per-item actions

#### Scenario: Buttons render on the active list
- When GET `/bookmarks`
- Then item 1 has buttons `Archive`, `Delete` and `Mark read`, item 2 has `Archive` and `Delete` and no `Mark read`
- And the Delete button's `data-on:click` contains `confirm(`
- And the page carries `data-signals` with `q`, `sort`, `unread`, `page`, `selected`, `selectAcross` and `bulkTags`

#### Scenario: Buttons render on the archive
- When GET `/bookmarks/archived`
- Then item 3 has buttons `Unarchive` and `Delete` and no `Archive`

#### Scenario: Archive patches the list and sidebar
- When POST `/bookmarks/1/archive` with signals `{"q": "", "sort": "added_desc", "unread": "", "page": 1}`
- Then the response is 200 `text/event-stream`
- And a `datastar-patch-elements` event contains `<ul id="bookmark-list"` with `Two` and without `One`
- And the same or another `datastar-patch-elements` event contains `<aside id="sidebar"`
- And GET `/api/bookmarks/1/` has `is_archived` true

#### Scenario: Unarchive from the archive page
- When POST `/bookmarks/3/unarchive` with signals for the archive page
- Then the patched `#bookmark-list` has no items and GET `/api/bookmarks/3/` has `is_archived` false

#### Scenario: Delete removes the bookmark
- When POST `/bookmarks/2/delete`
- Then the patched `#bookmark-list` contains `One` and not `Two`
- And GET `/api/bookmarks/2/` answers 404

#### Scenario: Mark read
- When POST `/bookmarks/1/read`
- Then the patched item 1 does not carry the class `unread` and GET `/api/bookmarks/1/` has `unread` false

#### Scenario: The re-render honours the page's query
- When POST `/bookmarks/1/archive` with signals `{"q": "Two", "sort": "added_desc", "unread": "", "page": 1}`
- Then the patched `#bookmark-list` contains exactly `Two`

#### Scenario: Acting on the last item of the last page steps back a page
- Given thirty-one active bookmarks so that page 2 holds one item
- When POST `/bookmarks/<that item>/archive` with `page` 2
- Then the patched `#bookmark-list` holds thirty items
- And a `datastar-patch-signals` event sets `page` to 1

#### Scenario: Unknown id
- When POST `/bookmarks/999/archive`
- Then the response is 404

## Feature: Bulk bar

#### Scenario: The bulk bar renders with checkboxes
- When GET `/bookmarks`
- Then the page contains `<div id="bulk-bar"` with buttons `Archive`, `Delete`, `Tag`, `Untag`, `Mark read`, `Mark unread`, a text input bound to `bulkTags`, a checkbox `Select all` and a checkbox bound to `selectAcross`
- And item 1 has a checkbox with `data-bind:selected.b1` and item 2 with `data-bind:selected.b2`

#### Scenario: The archive page offers Unarchive instead of Archive
- When GET `/bookmarks/archived`
- Then the bulk bar has a button `Unarchive` and no button `Archive`

#### Scenario Outline: Bulk actions apply to the selected ids
- When POST `/bookmarks/bulk` with signals `{"action": "<action>", "selected": {"b1": true, "b2": false}, "selectAcross": false, "bulkTags": "", "q": "", "sort": "added_desc", "unread": "", "page": 1}`
- Then GET `/api/bookmarks/1/` <effect on 1>
- And GET `/api/bookmarks/2/` <effect on 2>

Examples:
| action  | effect on 1                   | effect on 2                    |
| archive | has `is_archived` true        | has `is_archived` false        |
| delete  | answers 404                   | answers 200                    |
| read    | has `unread` false            | has `unread` false             |
| unread  | has `unread` true             | has `unread` false             |

#### Scenario: Bulk unarchive from the archive page
- When POST `/bookmarks/bulk` with `action` `unarchive` and `selected` `{"b3": true}` and the archive page's signals
- Then GET `/api/bookmarks/3/` has `is_archived` false

#### Scenario: Bulk tag adds names
- Given bookmark 1 is tagged `keep`
- When POST `/bookmarks/bulk` with `action` `tag`, `bulkTags` `alpha Beta`, `selected` `{"b1": true, "b2": true}`
- Then GET `/api/bookmarks/1/` has `tag_names` `["alpha", "Beta", "keep"]` and GET `/api/bookmarks/2/` has `["alpha", "Beta"]`

#### Scenario: Bulk untag removes names
- Given bookmarks 1 and 2 are tagged `alpha` and `keep`
- When POST `/bookmarks/bulk` with `action` `untag`, `bulkTags` `ALPHA`, `selected` `{"b1": true, "b2": true}`
- Then both have `tag_names` `["keep"]`

#### Scenario: The response resets the selection
- When POST `/bookmarks/bulk` with `action` `read` and `selected` `{"b1": true}` and `bulkTags` `x`
- Then a `datastar-patch-signals` event sets `selected` to `{}`, `selectAcross` to false and `bulkTags` to `""`
- And `datastar-patch-elements` events contain `<ul id="bookmark-list"`, `<aside id="sidebar"` and `<div id="bulk-bar"`

#### Scenario: Select across applies to the filtered result only
- Given bookmarks `https://example.com/4` tagged `python` and `https://example.com/5` tagged `python`, and `https://example.com/6` tagged `rust`
- When POST `/bookmarks/bulk` with `action` `archive`, `selectAcross` true, `selected` `{}`, `q` `#python`
- Then bookmarks 4 and 5 have `is_archived` true
- And bookmarks 1, 2 and 6 have `is_archived` false

#### Scenario: Select across respects the unread filter and the page kind
- When POST `/bookmarks/bulk` with `action` `delete`, `selectAcross` true, `unread` `yes`, `q` ``
- Then GET `/api/bookmarks/1/` answers 404
- And bookmarks 2 and 3 still exist

#### Scenario: Nothing selected does nothing
- When POST `/bookmarks/bulk` with `action` `delete`, `selected` `{}`, `selectAcross` false
- Then the response is 200 and every bookmark still exists

#### Scenario: Unknown action
- When POST `/bookmarks/bulk` with `action` `explode`
- Then the response is 400

#### Scenario: More than a hundred selected ids
- Given one hundred and twenty active bookmarks
- When POST `/bookmarks/bulk` with `action` `read` and every one of them selected
- Then the response is 200 and all of them have `unread` false

## Feature: Request requirements

#### Scenario: Missing Datastar header
- When POST `/bookmarks/1/archive` as a form post with `Origin: https://lnkr.test` and no `Datastar-Request` header
- Then the response is 400 and GET `/api/bookmarks/1/` has `is_archived` false

#### Scenario: Actions need a session
- Given no cookie
- When POST `/bookmarks/1/archive` with the Datastar header
- Then the response redirects to `/login?next=%2Fbookmarks%2F1%2Farchive`
