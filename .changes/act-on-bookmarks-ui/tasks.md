# Tasks — act-on-bookmarks-ui

## Behavioral  (one per scenario → a red-green cycle)
- [x] B1  Buttons render on the active list                          → behavior.md §Per-item actions
- [x] B2  Buttons render on the archive                              → behavior.md §Per-item actions
- [x] B3  Archive patches the list and sidebar                       → behavior.md §Per-item actions
- [x] B4  Unarchive from the archive page                            → behavior.md §Per-item actions
- [x] B5  Delete removes the bookmark                                → behavior.md §Per-item actions
- [x] B6  Mark read                                                  → behavior.md §Per-item actions
- [x] B7  The re-render honours the page's query                     → behavior.md §Per-item actions
- [x] B8  Acting on the last item of the last page steps back a page → behavior.md §Per-item actions
- [x] B9  Unknown id                                                 → behavior.md §Per-item actions
- [x] B10 The bulk bar renders with checkboxes                       → behavior.md §Bulk bar
- [x] B11 The archive page offers Unarchive instead of Archive       → behavior.md §Bulk bar
- [x] B12 Bulk actions apply to the selected ids                     → behavior.md §Bulk bar
- [x] B13 Bulk unarchive from the archive page                       → behavior.md §Bulk bar
- [x] B14 Bulk tag adds names                                        → behavior.md §Bulk bar
- [x] B15 Bulk untag removes names                                   → behavior.md §Bulk bar
- [x] B16 The response resets the selection                          → behavior.md §Bulk bar
- [x] B17 Select across applies to the filtered result only          → behavior.md §Bulk bar
- [x] B18 Select across respects the unread filter and the page kind → behavior.md §Bulk bar
- [x] B19 Nothing selected does nothing                              → behavior.md §Bulk bar
- [x] B20 Unknown action                                             → behavior.md §Bulk bar
- [x] B21 More than a hundred selected ids                           → behavior.md §Bulk bar
- [x] B22 Missing Datastar header                                    → behavior.md §Request requirements
- [x] B23 Actions need a session                                     → behavior.md §Request requirements

## Chores  (non-behavioral work: migrations, wiring, config)
- [x] C1  renderListFragments and page signals in the list view
- [x] C2  Bulk query functions with json_each

## Docs
- [x] D1  Write docs/capabilities/bookmark-actions.md
