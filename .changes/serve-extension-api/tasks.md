# Tasks — serve-extension-api

## Behavioral  (one per scenario → a red-green cycle)
- [x] B1  A token is created on first view                          → behavior.md §API token on the settings page
- [x] B2  Regenerate replaces the token                             → behavior.md §API token on the settings page
- [x] B3  Missing token                                             → behavior.md §API authentication
- [x] B4  Unknown token                                             → behavior.md §API authentication
- [x] B5  Session cookies do not authenticate the API               → behavior.md §API authentication
- [x] B6  Create with every field                                   → behavior.md §Create bookmarks
- [x] B7  Tag names are trimmed and deduplicated regardless of case → behavior.md §Create bookmarks
- [x] B8  Existing URL updates instead of duplicating               → behavior.md §Create bookmarks
- [x] B9  Empty title and description are filled from the page      → behavior.md §Create bookmarks
- [x] B10 Provided fields are not overwritten by the page           → behavior.md §Create bookmarks
- [x] B11 disable_scraping skips the page fetch                     → behavior.md §Create bookmarks
- [x] B12 Unreachable page leaves fields empty                      → behavior.md §Create bookmarks
- [x] B13 Invalid URLs are refused                                  → behavior.md §Create bookmarks
- [x] B14 Active list excludes archived, newest first               → behavior.md §List bookmarks
- [x] B15 Archived list contains only archived                      → behavior.md §List bookmarks
- [x] B16 Limit and offset paginate with absolute links             → behavior.md §List bookmarks
- [x] B17 modified_since filters by modification time               → behavior.md §List bookmarks
- [x] B18 added_since filters by creation time                      → behavior.md §List bookmarks
- [x] B19 Get by id                                                 → behavior.md §Read, update and delete a bookmark
- [x] B20 Unknown id                                                → behavior.md §Read, update and delete a bookmark
- [x] B21 PUT replaces and resets omitted fields                    → behavior.md §Read, update and delete a bookmark
- [x] B22 PATCH changes only given fields                           → behavior.md §Read, update and delete a bookmark
- [x] B23 PUT requires a url                                        → behavior.md §Read, update and delete a bookmark
- [x] B24 Changing the url onto another bookmark is refused         → behavior.md §Read, update and delete a bookmark
- [x] B25 Delete                                                    → behavior.md §Read, update and delete a bookmark
- [x] B26 Archive and unarchive                                     → behavior.md §Read, update and delete a bookmark
- [x] B27 Actions on unknown ids                                    → behavior.md §Read, update and delete a bookmark
- [x] B28 Known URL                                                 → behavior.md §Check a URL
- [x] B29 Unknown URL with reachable page                           → behavior.md §Check a URL
- [x] B30 Unreachable page                                          → behavior.md §Check a URL
- [x] B31 og:title is a fallback, not an override                   → behavior.md §Check a URL
- [x] B32 Missing url parameter                                     → behavior.md §Check a URL
- [x] B33 List, create, get                                         → behavior.md §Tags
- [x] B34 Creating an existing name returns the existing tag        → behavior.md §Tags
- [x] B35 Deleting a tag removes it from bookmarks                  → behavior.md §Tags
- [x] B36 Profile fields                                            → behavior.md §User profile

## Chores  (non-behavioral work: migrations, wiring, config)
- [x] C1  Migration version 2 in src/db/schema.ts
- [x] C2  src/api/index.ts router with strict: false mounted at /api, CSRF confined to the UI router
- [x] C3  test/helpers.ts additions: apiToken(), api(), mockPage()

## Docs
- [x] D1  Write docs/capabilities/rest-api.md (token auth, bookmarks, check, tags, profile)
