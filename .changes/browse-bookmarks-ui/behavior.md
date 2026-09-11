# Browse bookmarks in the UI Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in with cookie `C`
- And requests below carry `C` unless stated otherwise

## Feature: Bookmark list page

#### Scenario: Active bookmarks render newest first
- Given bookmarks `https://example.com/1` titled `One`, then `https://example.com/2` titled `Two`, then an archived `https://example.com/3` titled `Three`
- When GET `/bookmarks`
- Then the response is 200 and the list has items titled `Two` then `One`
- And `Three` is absent

#### Scenario: Archived page lists only archived bookmarks
- Given the same bookmarks
- When GET `/bookmarks/archived`
- Then the list has exactly one item titled `Three`

#### Scenario: An item shows its fields
- Given a bookmark `https://example.com/a` with title `A`, description `About A`, tags `alpha` and `beta`, notes `line one` newline `line two`, unread
- When GET `/bookmarks`
- Then the item has a link with text `A` and `href` `https://example.com/a` and `target` `_blank`
- And it contains `About A`
- And it has tag links `#alpha` to `/bookmarks?q=%23alpha` and `#beta` to `/bookmarks?q=%23beta`
- And it has a `details` element whose text contains `line one` and `line two` on separate lines
- And the item carries the class `unread`

#### Scenario: Empty title falls back to the URL
- Given a bookmark `https://example.com/untitled` with an empty title
- When GET `/bookmarks`
- Then the item link text is `https://example.com/untitled`

#### Scenario: Content is escaped
- Given a bookmark titled `<script>alert(1)</script>` with notes `<b>bold</b>`
- When GET `/bookmarks`
- Then the body contains `&lt;script&gt;alert(1)&lt;/script&gt;` and `&lt;b&gt;bold&lt;/b&gt;`
- And the body does not contain `<script>alert(1)</script>`

#### Scenario: The date links to the Web Archive
- Given the system time is `2026-09-11T12:00:00Z` and a bookmark added at `2026-09-08T09:15:30.000Z` with url `https://example.com/old`
- When GET `/bookmarks`
- Then the item's date link has `href` `https://web.archive.org/web/20260908091530/https://example.com/old`
- And its text is `3 days ago` and its `title` attribute is `2026-09-08 09:15`

#### Scenario: Empty states
- Given no bookmarks
- When GET `/bookmarks`
- Then the page contains `No bookmarks yet`
- Given one bookmark titled `One`
- When GET `/bookmarks?q=zzz`
- Then the page contains `No bookmarks found`

## Feature: Search, sort and filter

### Background:
- Given bookmarks titled `Banana`, `apple` and `Cherry` created in that order, with `apple` unread

#### Scenario: Search filters and keeps its value
- When GET `/bookmarks?q=an`
- Then the list has exactly one item titled `Banana`
- And the search input has value `an`

#### Scenario Outline: Sort orders the list
- When GET `/bookmarks?sort=<sort>`
- Then the item titles are `<order>`

Examples:
| sort       | order                  |
| added_desc | Cherry, apple, Banana  |
| added_asc  | Banana, apple, Cherry  |
| title_asc  | apple, Banana, Cherry  |
| title_desc | Cherry, Banana, apple  |
| bogus      | Cherry, apple, Banana  |

#### Scenario: Unread filter
- When GET `/bookmarks?unread=yes`
- Then the list has exactly one item titled `apple`

#### Scenario: The search form keeps sort and unread
- When GET `/bookmarks?sort=title_asc&unread=yes`
- Then the search form contains hidden inputs `sort` with value `title_asc` and `unread` with value `yes`

## Feature: Pagination

### Background:
- Given thirty-one bookmarks titled `B01` to `B31` created in that order

#### Scenario: First page shows thirty and links to the next
- When GET `/bookmarks`
- Then the list has thirty items, the first titled `B31` and the last titled `B02`
- And a link `Next` to `/bookmarks?page=2` is present and no `Previous` link is present
- And the page contains `Page 1 of 2`

#### Scenario: Second page shows the rest and links back
- When GET `/bookmarks?page=2`
- Then the list has one item titled `B01`
- And a link `Previous` to `/bookmarks?page=1` is present and no `Next` link is present

#### Scenario: Page links keep the query
- When GET `/bookmarks?q=B&sort=added_asc`
- Then the `Next` link is `/bookmarks?q=B&sort=added_asc&page=2`

#### Scenario: Out-of-range page shows the last page
- When GET `/bookmarks?page=9`
- Then the list has one item titled `B01` and the page contains `Page 2 of 2`

## Feature: Tag sidebar

### Background:
- Given bookmark `https://example.com/1` tagged `python` and `web`, `https://example.com/2` tagged `python`, and `https://example.com/3` tagged `rust`

#### Scenario: Tags of the whole result with counts
- When GET `/bookmarks`
- Then the sidebar lists `python` with count `2`, `rust` with count `1` and `web` with count `1`, in that order

#### Scenario: Sidebar follows the filter
- When GET `/bookmarks?q=%23python`
- Then the sidebar lists `python` with count `2` and `web` with count `1` and not `rust`

#### Scenario: A tag link adds the tag to the query
- When GET `/bookmarks?q=example`
- Then the sidebar link for `rust` points to `/bookmarks?q=example+%23rust`

#### Scenario: A selected tag can be removed
- When GET `/bookmarks?q=example+%23python`
- Then the sidebar marks `python` as selected with a link to `/bookmarks?q=example`

#### Scenario: Sidebar counts span all pages
- Given thirty-five more bookmarks tagged `many`
- When GET `/bookmarks`
- Then the sidebar lists `many` with count `35`

## Feature: Navigation and access

#### Scenario: Root redirects to the list
- When GET `/`
- Then the response redirects to `/bookmarks`

#### Scenario: List pages need a session
- Given no cookie
- When GET `/bookmarks/archived?q=x`
- Then the response redirects to `/login?next=%2Fbookmarks%2Farchived%3Fq%3Dx`

#### Scenario: The nav marks the current section
- When GET `/bookmarks`
- Then the nav link `Bookmarks` carries the class `active` and `Archived` does not
- When GET `/bookmarks/archived`
- Then the nav link `Archived` carries the class `active`
