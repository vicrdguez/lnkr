# Tasks — act-on-bookmarks-ui

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  Buttons render on the active list                          → behavior.md §Per-item actions
- [ ] B2  Buttons render on the archive                              → behavior.md §Per-item actions
- [ ] B3  Archive patches the list and sidebar                       → behavior.md §Per-item actions
- [ ] B4  Unarchive from the archive page                            → behavior.md §Per-item actions
- [ ] B5  Delete removes the bookmark                                → behavior.md §Per-item actions
- [ ] B6  Mark read                                                  → behavior.md §Per-item actions
- [ ] B7  The re-render honours the page's query                     → behavior.md §Per-item actions
- [ ] B8  Acting on the last item of the last page steps back a page → behavior.md §Per-item actions
- [ ] B9  Unknown id                                                 → behavior.md §Per-item actions
- [ ] B10 The bulk bar renders with checkboxes                       → behavior.md §Bulk bar
- [ ] B11 The archive page offers Unarchive instead of Archive       → behavior.md §Bulk bar
- [ ] B12 Bulk actions apply to the selected ids                     → behavior.md §Bulk bar
- [ ] B13 Bulk unarchive from the archive page                       → behavior.md §Bulk bar
- [ ] B14 Bulk tag adds names                                        → behavior.md §Bulk bar
- [ ] B15 Bulk untag removes names                                   → behavior.md §Bulk bar
- [ ] B16 The response resets the selection                          → behavior.md §Bulk bar
- [ ] B17 Select across applies to the filtered result only          → behavior.md §Bulk bar
- [ ] B18 Select across respects the unread filter and the page kind → behavior.md §Bulk bar
- [ ] B19 Nothing selected does nothing                              → behavior.md §Bulk bar
- [ ] B20 Unknown action                                             → behavior.md §Bulk bar
- [ ] B21 More than a hundred selected ids                           → behavior.md §Bulk bar
- [ ] B22 Missing Datastar header                                    → behavior.md §Request requirements
- [ ] B23 Actions need a session                                     → behavior.md §Request requirements

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  renderListFragments and page signals in the list view
- [ ] C2  Bulk query functions with json_each

## Docs
- [ ] D1  Write docs/capabilities/bookmark-actions.md
