# Tasks — serve-extension-api

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  A token is created on first view                          → behavior.md §API token on the settings page
- [ ] B2  Regenerate replaces the token                             → behavior.md §API token on the settings page
- [ ] B3  Missing token                                             → behavior.md §API authentication
- [ ] B4  Unknown token                                             → behavior.md §API authentication
- [ ] B5  Session cookies do not authenticate the API               → behavior.md §API authentication
- [ ] B6  Create with every field                                   → behavior.md §Create bookmarks
- [ ] B7  Tag names are trimmed and deduplicated regardless of case → behavior.md §Create bookmarks
- [ ] B8  Existing URL updates instead of duplicating               → behavior.md §Create bookmarks
- [ ] B9  Empty title and description are filled from the page      → behavior.md §Create bookmarks
- [ ] B10 Provided fields are not overwritten by the page           → behavior.md §Create bookmarks
- [ ] B11 disable_scraping skips the page fetch                     → behavior.md §Create bookmarks
- [ ] B12 Unreachable page leaves fields empty                      → behavior.md §Create bookmarks
- [ ] B13 Invalid URLs are refused                                  → behavior.md §Create bookmarks
- [ ] B14 Active list excludes archived, newest first               → behavior.md §List bookmarks
- [ ] B15 Archived list contains only archived                      → behavior.md §List bookmarks
- [ ] B16 Limit and offset paginate with absolute links             → behavior.md §List bookmarks
- [ ] B17 modified_since filters by modification time               → behavior.md §List bookmarks
- [ ] B18 added_since filters by creation time                      → behavior.md §List bookmarks
- [ ] B19 Get by id                                                 → behavior.md §Read, update and delete a bookmark
- [ ] B20 Unknown id                                                → behavior.md §Read, update and delete a bookmark
- [ ] B21 PUT replaces and resets omitted fields                    → behavior.md §Read, update and delete a bookmark
- [ ] B22 PATCH changes only given fields                           → behavior.md §Read, update and delete a bookmark
- [ ] B23 PUT requires a url                                        → behavior.md §Read, update and delete a bookmark
- [ ] B24 Changing the url onto another bookmark is refused         → behavior.md §Read, update and delete a bookmark
- [ ] B25 Delete                                                    → behavior.md §Read, update and delete a bookmark
- [ ] B26 Archive and unarchive                                     → behavior.md §Read, update and delete a bookmark
- [ ] B27 Actions on unknown ids                                    → behavior.md §Read, update and delete a bookmark
- [ ] B28 Known URL                                                 → behavior.md §Check a URL
- [ ] B29 Unknown URL with reachable page                           → behavior.md §Check a URL
- [ ] B30 Unreachable page                                          → behavior.md §Check a URL
- [ ] B31 og:title is a fallback, not an override                   → behavior.md §Check a URL
- [ ] B32 Missing url parameter                                     → behavior.md §Check a URL
- [ ] B33 List, create, get                                         → behavior.md §Tags
- [ ] B34 Creating an existing name returns the existing tag        → behavior.md §Tags
- [ ] B35 Deleting a tag removes it from bookmarks                  → behavior.md §Tags
- [ ] B36 Profile fields                                            → behavior.md §User profile

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Migration version 2 in src/db/schema.ts
- [ ] C2  src/api/index.ts router with strict: false mounted at /api, CSRF confined to the UI router
- [ ] C3  test/helpers.ts additions: apiToken(), api(), mockPage()

## Docs
- [ ] D1  Write docs/capabilities/rest-api.md (token auth, bookmarks, check, tags, profile)
