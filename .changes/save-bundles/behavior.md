# Save bundles Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in with cookie `C` and API token `T`
- And bookmarks: `https://a.test/` titled `A` tagged `python` and `web`; `https://b.test/` titled `B` tagged `python`; `https://c.test/` titled `C` tagged `rust`; `https://d.test/` titled `Django docs` tagged `python`, `web` and `docs`
- And form posts carry `Origin: https://lnkr.test`

## Feature: Bundle pages

#### Scenario: Create a bundle
- When POST `/bundles/new` with name `Py web`, search `docs`, any_tags `python`, all_tags `web`, excluded_tags `rust`
- Then the response redirects to `/bundles`
- And GET `/bundles` lists `Py web`
- And GET `/api/bundles/` has `count` 1 with `name` `Py web`, `search` `docs`, `any_tags` `python`, `all_tags` `web`, `excluded_tags` `rust`, `order` 0

#### Scenario: Name is required
- When POST `/bundles/new` with name ``
- Then the response is 400 with the form and an error
- And GET `/api/bundles/` has `count` 0

#### Scenario: Edit a bundle
- Given a Bundle `Old` with id `1`
- When GET `/bundles/1/edit`
- Then the form holds `Old`
- When POST `/bundles/1/edit` with name `New` and any_tags `rust`
- Then the response redirects to `/bundles` and GET `/api/bundles/1/` has `name` `New`, `any_tags` `rust` and a later `date_modified`

#### Scenario: Delete a bundle
- Given a Bundle with id `1`
- When POST `/bundles/1/delete`
- Then the response redirects to `/bundles` and GET `/api/bundles/1/` answers 404

#### Scenario: Reorder
- Given Bundles `First` (order 0), `Second` (order 1), `Third` (order 2)
- When POST `/bundles/<Third.id>/up`
- Then GET `/bundles` lists `First`, `Third`, `Second`
- When POST `/bundles/<First.id>/down`
- Then GET `/bundles` lists `Third`, `First`, `Second`
- And GET `/api/bundles/` returns them with `order` 0, 1, 2 in that order

## Feature: Sidebar and list filtering

### Background:
- Given a Bundle `Py` with id `1`, any_tags `python`, and a Bundle `Docs` with id `2`, search `docs`

#### Scenario: The sidebar lists bundles in order
- When GET `/bookmarks`
- Then the sidebar has a section `Bundles` with links `Py` to `/bookmarks?bundle=1` and `Docs` to `/bookmarks?bundle=2`, in that order

#### Scenario: The active bundle is marked and can be cleared
- When GET `/bookmarks?bundle=1&q=web`
- Then the sidebar link `Py` carries the class `active`
- And a link `Clear` points to `/bookmarks?q=web`
- And the page's `data-signals` include `bundle` `1`

#### Scenario: A bundle narrows the list
- When GET `/bookmarks?bundle=1`
- Then the item titles are `Django docs`, `B`, `A`

#### Scenario: A bundle combines with q and the unread filter
- Given `A` is unread
- When GET `/bookmarks?bundle=1&q=web&unread=yes`
- Then the item titles are exactly `A`

#### Scenario: The tag sidebar reflects the bundle
- When GET `/bookmarks?bundle=1`
- Then the tag sidebar lists `python` with count `3`, `web` with count `2`, `docs` with count `1` and not `rust`

#### Scenario: The archive keeps the bundle
- Given `B` is archived
- When GET `/bookmarks/archived?bundle=1`
- Then the item titles are exactly `B`
- And the sidebar link `Py` points to `/bookmarks/archived?bundle=1`

#### Scenario: An unknown bundle is ignored on the page
- When GET `/bookmarks?bundle=999`
- Then the item titles are `Django docs`, `C`, `B`, `A`

#### Scenario: Pagination keeps the bundle
- Given thirty more bookmarks tagged `python`
- When GET `/bookmarks?bundle=1`
- Then the `Next` link is `/bookmarks?bundle=1&page=2`

## Feature: Bundle composition

#### Scenario Outline: Each part restricts the result
- Given a Bundle with search `<search>`, any_tags `<any>`, all_tags `<all>`, excluded_tags `<excluded>`
- When GET `/api/bookmarks/?bundle=<id>`
- Then the result urls are exactly `<results>`

Examples:
| search | any         | all         | excluded | results                         |
|        |             |             |          | d.test, c.test, b.test, a.test  |
| docs   |             |             |          | d.test                          |
|        | python      |             |          | d.test, b.test, a.test          |
|        | python rust |             |          | d.test, c.test, b.test, a.test  |
|        |             | python web  |          | d.test, a.test                  |
|        |             |             | web      | c.test, b.test                  |
|        | PYTHON      |             | DOCS     | b.test, a.test                  |
| not docs | python    | web         |          | a.test                          |
| (docs  |             |             |          |                                 |

#### Scenario: Bundle and q are both required
- Given a Bundle with id `1` and any_tags `python`
- When GET `/api/bookmarks/?bundle=1&q=rust`
- Then `count` is 0
- When GET `/api/bookmarks/?bundle=1&q=%23web`
- Then the result urls are exactly `d.test, a.test`

## Feature: Actions keep the bundle view

### Background:
- Given a Bundle `Py` with id `1` and any_tags `python`

#### Scenario: An item action re-renders the bundle view
- When POST `/bookmarks/<A.id>/archive` as a Datastar action with signals `{"q": "", "sort": "added_desc", "unread": "", "page": 1, "bundle": "1"}`
- Then the patched `#bookmark-list` contains `Django docs` and `B` and not `A` and not `C`

#### Scenario: Select across applies to the bundle
- When POST `/bookmarks/bulk` as a Datastar action with `action` `archive`, `selectAcross` true, `selected` `{}` and `bundle` `1`
- Then `A`, `B` and `Django docs` have `is_archived` true and `C` does not

## Feature: Bundles API

#### Scenario: Create through the API
- When POST `/api/bundles/` with JSON `{"name": "Py", "any_tags": "python"}`
- Then the response is 201 with exactly the keys `id`, `name`, `search`, `any_tags`, `all_tags`, `excluded_tags`, `order`, `date_created`, `date_modified`
- And `search`, `all_tags` and `excluded_tags` are empty strings and `order` is 0

#### Scenario: A new bundle goes last
- Given Bundles with `order` 0 and 1
- When POST `/api/bundles/` with JSON `{"name": "Z"}`
- Then `order` is 2

#### Scenario: Name is required in the API
- When POST `/api/bundles/` with JSON `{"search": "x"}`
- Then the response is 400 with JSON `{"name": ["This field is required."]}`

#### Scenario: List, get, put, patch, delete
- Given a Bundle `Py` with id `1`
- When GET `/api/bundles/`
- Then `count` is 1 and the result is `Py`
- When PUT `/api/bundles/1/` with JSON `{"name": "Py2"}`
- Then the response is 200 with `name` `Py2` and `any_tags` empty
- When PATCH `/api/bundles/1/` with JSON `{"any_tags": "python"}`
- Then the response is 200 with `name` `Py2` and `any_tags` `python`
- When DELETE `/api/bundles/1/`
- Then the response is 204 and GET `/api/bundles/1/` answers 404

#### Scenario: Unknown bundle on the bookmarks API
- When GET `/api/bookmarks/?bundle=999`
- Then the response is 400 with JSON `{"bundle": ["Invalid bundle."]}`

#### Scenario: Token required
- When GET `/api/bundles/` without a token
- Then the response is 401
