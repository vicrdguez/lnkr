# Tune display preferences Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in with cookie `C` and API token `T`
- And form posts carry `Origin: https://lnkr.test`
- And a bookmark `https://example.com/a` titled `A`, description `About A`, notes `note`, tagged `alpha` and `beta`, unread, added at `2026-09-08T09:15:30.000Z`

## Feature: General settings form

#### Scenario: Defaults are shown
- When GET `/settings`
- Then the General form has `theme` `auto`, `bookmark_date_display` `relative`, `bookmark_description_display` `inline`, `bookmark_description_max_lines` `1`, `bookmark_link_target` `_blank`, `display_url` unchecked, `tag_search` `strict`, `tag_grouping` `alphabetical`, `sticky_pagination` unchecked, `collapse_side_panel` unchecked, `items_per_page` `30`, the three action flags checked, `default_mark_unread` unchecked, `permanent_notes` unchecked, `custom_css` empty

#### Scenario: Saving stores every field
- When POST `/settings/general` with theme `dark`, bookmark_date_display `absolute`, bookmark_description_display `separate`, bookmark_description_max_lines `3`, bookmark_link_target `_self`, display_url `on`, tag_search `lax`, tag_grouping `disabled`, sticky_pagination `on`, collapse_side_panel `on`, items_per_page `50`, display_edit_bookmark_action absent, display_archive_bookmark_action `on`, display_remove_bookmark_action absent, default_mark_unread `on`, permanent_notes `on`, custom_css `body{}`
- Then the response redirects to `/settings`
- And GET `/settings` shows each of those values

#### Scenario Outline: Invalid values fall back to defaults
- When POST `/settings/general` with `<field>` `<value>`
- Then GET `/settings` shows `<field>` as `<shown>`

Examples:
| field                         | value  | shown      |
| theme                         | blue   | auto       |
| items_per_page                | 5      | 30         |
| items_per_page                | abc    | 30         |
| bookmark_description_max_lines| 0      | 1          |
| tag_search                    | fuzzy  | strict     |

## Feature: Theme

#### Scenario Outline: The document carries the theme
- Given theme is `<theme>`
- When GET `/bookmarks`
- Then the `html` element has `data-theme` `<attr>`

Examples:
| theme | attr  |
| auto  | auto  |
| light | light |
| dark  | dark  |

## Feature: List display preferences

#### Scenario Outline: Date display
- Given bookmark_date_display is `<mode>` and the system time is `2026-09-11T12:00:00Z`
- When GET `/bookmarks`
- Then the item's date element `<outcome>`

Examples:
| mode     | outcome                                 |
| relative | has text `3 days ago`                   |
| absolute | has text `2026-09-08`                   |
| hidden   | is absent                               |

#### Scenario: Separate description display with max lines
- Given bookmark_description_display is `separate` and bookmark_description_max_lines is `3`
- When GET `/bookmarks`
- Then the list carries the class `description-separate` and a style setting `--ld-bookmark-description-max-lines: 3`
- And the description and the tags are in separate elements

#### Scenario: Inline description display
- Given bookmark_description_display is `inline`
- When GET `/bookmarks`
- Then the list carries the class `description-inline` and the description and the tags share one element

#### Scenario Outline: Link target
- Given bookmark_link_target is `<target>`
- When GET `/bookmarks`
- Then the title link has `target` `<target>`

Examples:
| target |
| _blank |
| _self  |

#### Scenario: URL display
- Given display_url is on
- When GET `/bookmarks`
- Then the item contains a `.url` element with text `https://example.com/a`
- Given display_url is off
- When GET `/bookmarks`
- Then the item contains no `.url` element

#### Scenario Outline: Action visibility
- Given `<flag>` is off
- When GET `/bookmarks`
- Then the item has no `<control>`
- And the other two controls are present

Examples:
| flag                           | control          |
| display_edit_bookmark_action   | `Edit` link      |
| display_archive_bookmark_action| `Archive` button |
| display_remove_bookmark_action | `Delete` button  |

#### Scenario: Permanent notes
- Given permanent_notes is on
- When GET `/bookmarks`
- Then the item's `details` element carries the `open` attribute
- Given permanent_notes is off
- When GET `/bookmarks`
- Then it does not

#### Scenario: Sticky pagination and collapsed side panel classes
- Given sticky_pagination and collapse_side_panel are on
- When GET `/bookmarks`
- Then the page carries the classes `sticky-pagination` and `side-panel-collapsed`

## Feature: Search behaviour preferences

#### Scenario: Lax tag search matches tag names
- Given tag_search is `lax`
- When GET `/bookmarks?q=alpha`
- Then the item titles are exactly `A`
- And GET `/api/bookmarks/?q=alpha` with token `T` has `count` 1

#### Scenario: Strict tag search does not
- Given tag_search is `strict`
- When GET `/bookmarks?q=alpha`
- Then the list is empty

#### Scenario: Alphabetical tag grouping
- Given tags `alpha`, `apple`, `beta` are in use and tag_grouping is `alphabetical`
- When GET `/bookmarks`
- Then the sidebar has a heading `A` followed by `alpha` and `apple`, then a heading `B` followed by `beta`

#### Scenario: Disabled tag grouping
- Given tag_grouping is `disabled`
- When GET `/bookmarks`
- Then the sidebar has no letter headings

#### Scenario: Items per page
- Given items_per_page is `10` and twelve active bookmarks
- When GET `/bookmarks`
- Then the list has ten items and the page contains `Page 1 of 2`
- When GET `/bookmarks/archived` with twelve archived bookmarks
- Then the list has ten items

## Feature: Form and notes defaults

#### Scenario: Default mark unread
- Given default_mark_unread is on
- When GET `/bookmarks/new`
- Then the `unread` checkbox is checked
- And POST `/api/bookmarks/` with token `T` and url `https://example.com/n` creates a bookmark with `unread` false

## Feature: Custom CSS

#### Scenario: Custom CSS is served and linked
- Given custom_css is `body { color: red }`
- When GET `/bookmarks`
- Then the head contains `<link rel="stylesheet" href="/custom_css?v=<hash>">` with an 8-character hex hash
- When GET `/custom_css`
- Then the response is 200 with `Content-Type` `text/css; charset=utf-8`, `Cache-Control` `max-age=2592000`, body `body { color: red }`

#### Scenario: The hash follows the content
- Given custom_css is `a {}` and the layout links `/custom_css?v=<h1>`
- When custom_css is changed to `b {}`
- Then the layout links `/custom_css?v=<h2>` with `h2` different from `h1`

#### Scenario: Empty CSS is not linked
- Given custom_css is empty
- When GET `/bookmarks`
- Then the head contains no link to `/custom_css`
- And GET `/custom_css` answers 200 with an empty body

## Feature: Saved search preferences

#### Scenario: Save the current sort and filter
- When POST `/bookmarks/search-preferences` with sort `title_asc` and unread `yes`
- Then the response redirects to `/bookmarks`
- And GET `/bookmarks` lists bookmarks by title and only unread ones, with the search form showing `title_asc` and `yes`
- And GET `/bookmarks?sort=added_desc&unread=` lists newest first with every bookmark

#### Scenario: Profile reports search preferences
- Given search preferences sort `title_asc` and unread `yes` were saved
- When GET `/api/user/profile/` with token `T`
- Then `search_preferences` is `{"sort": "title_asc", "shared": "off", "unread": "yes"}`

## Feature: Profile

#### Scenario: Profile reports stored preferences
- Given theme `dark`, bookmark_date_display `absolute`, bookmark_link_target `_self`, tag_search `lax`, display_url on, permanent_notes on
- When GET `/api/user/profile/` with token `T`
- Then `theme` is `dark`, `bookmark_date_display` `absolute`, `bookmark_link_target` `_self`, `tag_search` `lax`, `display_url` true, `permanent_notes` true
- And `web_archive_integration` is `disabled`, `enable_sharing` false, `enable_public_sharing` false
