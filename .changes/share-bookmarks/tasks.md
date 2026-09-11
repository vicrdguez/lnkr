# Tasks — share-bookmarks

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  The section saves and the profile reports                        → behavior.md §Sharing preferences
- [ ] B2  Default mark shared preselects the form                          → behavior.md §Sharing preferences
- [ ] B3  Sharing off hides the controls                                   → behavior.md §Sharing preferences
- [ ] B4  Sharing through the API appears for another user                 → behavior.md §Marking bookmarks shared
- [ ] B5  The item button shares and unshares                              → behavior.md §Marking bookmarks shared
- [ ] B6  Bulk share and unshare                                           → behavior.md §Marking bookmarks shared
- [ ] B7  Edits propagate                                                  → behavior.md §Marking bookmarks shared
- [ ] B8  Deleting removes the shared entry                                → behavior.md §Marking bookmarks shared
- [ ] B9  Turning sharing off removes every entry and on restores them     → behavior.md §Marking bookmarks shared
- [ ] B10 Shared flag without sharing enabled has no effect                → behavior.md §Marking bookmarks shared
- [ ] B11 Re-sync rebuilds the index                                       → behavior.md §Marking bookmarks shared
- [ ] B12 Newest first across users with owners                            → behavior.md §The shared page
- [ ] B13 q matches title, description and url                             → behavior.md §The shared page
- [ ] B14 user filters by owner                                            → behavior.md §The shared page
- [ ] B15 Pagination spans users                                           → behavior.md §The shared page
- [ ] B16 Tag links search the shared page                                 → behavior.md §The shared page
- [ ] B17 Anonymous visitors see public rows only                          → behavior.md §Public sharing
- [ ] B18 Turning public sharing off hides the rows                        → behavior.md §Public sharing
- [ ] B19 Logged-in users still see everything shared                      → behavior.md §Public sharing
- [ ] B20 The public feed lists public rows                                → behavior.md §Shared feeds
- [ ] B21 The token feed lists all shared rows                             → behavior.md §Shared feeds
- [ ] B22 q and limit apply                                                → behavior.md §Shared feeds
- [ ] B23 Landing page sends visitors to the shared page                   → behavior.md §Landing page and guest profile
- [ ] B24 The guest profile styles the anonymous page                      → behavior.md §Landing page and guest profile
- [ ] B25 No guest profile means defaults                                  → behavior.md §Landing page and guest profile

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Directory migration 2: shared_bookmarks; RPC methods; getGuestPrefs on the Tenant
- [ ] C2  syncShared wired into every write path; shared filter and page signal

## Docs
- [ ] D1  Write docs/capabilities/sharing.md and update docs/capabilities/rest-api.md
