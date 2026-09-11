# Tasks — browse-bookmarks-ui

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  Active bookmarks render newest first                      → behavior.md §Bookmark list page
- [ ] B2  Archived page lists only archived bookmarks               → behavior.md §Bookmark list page
- [ ] B3  An item shows its fields                                  → behavior.md §Bookmark list page
- [ ] B4  Empty title falls back to the URL                         → behavior.md §Bookmark list page
- [ ] B5  Content is escaped                                        → behavior.md §Bookmark list page
- [ ] B6  The date links to the Web Archive                         → behavior.md §Bookmark list page
- [ ] B7  Empty states                                              → behavior.md §Bookmark list page
- [ ] B8  Search filters and keeps its value                        → behavior.md §Search, sort and filter
- [ ] B9  Sort orders the list                                      → behavior.md §Search, sort and filter
- [ ] B10 Unread filter                                             → behavior.md §Search, sort and filter
- [ ] B11 The search form keeps sort and unread                     → behavior.md §Search, sort and filter
- [ ] B12 First page shows thirty and links to the next             → behavior.md §Pagination
- [ ] B13 Second page shows the rest and links back                 → behavior.md §Pagination
- [ ] B14 Page links keep the query                                 → behavior.md §Pagination
- [ ] B15 Out-of-range page shows the last page                     → behavior.md §Pagination
- [ ] B16 Tags of the whole result with counts                      → behavior.md §Tag sidebar
- [ ] B17 Sidebar follows the filter                                → behavior.md §Tag sidebar
- [ ] B18 A tag link adds the tag to the query                      → behavior.md §Tag sidebar
- [ ] B19 A selected tag can be removed                             → behavior.md §Tag sidebar
- [ ] B20 Sidebar counts span all pages                             → behavior.md §Tag sidebar
- [ ] B21 Root redirects to the list                                → behavior.md §Navigation and access
- [ ] B22 List pages need a session                                 → behavior.md §Navigation and access
- [ ] B23 The nav marks the current section                         → behavior.md §Navigation and access

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Shared WHERE builder, sort and unread options, tagCounts and tagNamesFor in src/db/bookmarks.ts
- [ ] C2  HTML extraction helper in test/helpers.ts
- [ ] C3  Stylesheet for list, sidebar, pagination and forms

## Docs
- [ ] D1  Write docs/capabilities/bookmark-list.md
