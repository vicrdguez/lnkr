# Tasks — search-bookmarks

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  Queries select the expected active bookmarks               → behavior.md §Query grammar on the active list
- [ ] B2  Unparsable queries answer zero results                     → behavior.md §Query grammar on the active list
- [ ] B3  An empty query returns everything active                   → behavior.md §Query grammar on the active list
- [ ] B4  A whitespace-only query returns everything active          → behavior.md §Query grammar on the active list
- [ ] B5  A query with too many terms answers zero results           → behavior.md §Query grammar on the active list
- [ ] B6  The archived list searches only archived bookmarks         → behavior.md §Query grammar on the archived list
- [ ] B7  The active list never returns archived matches             → behavior.md §Query grammar on the archived list
- [ ] B8  Search and pagination                                      → behavior.md §Search composes with the other list parameters
- [ ] B9  Search and added_since                                     → behavior.md §Search composes with the other list parameters
- [ ] B10 Each field is searched                                     → behavior.md §Term matching is a substring match on every text field

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  listBookmarks accepts a SearchFilter for count and page queries

## Docs
- [ ] D1  Update docs/capabilities/rest-api.md with the query grammar
