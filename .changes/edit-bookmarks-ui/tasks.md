# Tasks — edit-bookmarks-ui

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  The form renders empty                                    → behavior.md §New bookmark form
- [ ] B2  The form is prefilled from query parameters               → behavior.md §New bookmark form
- [ ] B3  Saving creates the bookmark                               → behavior.md §New bookmark form
- [ ] B4  Saving with auto_close ends on the close page             → behavior.md §New bookmark form
- [ ] B5  Saving an existing URL updates it                         → behavior.md §New bookmark form
- [ ] B6  Invalid URLs are refused                                  → behavior.md §New bookmark form
- [ ] B7  Existing URL fills the form and shows the notice          → behavior.md §URL check
- [ ] B8  New URL fills empty fields from the page                  → behavior.md §URL check
- [ ] B9  Unreachable page patches nothing but the hint             → behavior.md §URL check
- [ ] B10 Invalid URL patches only an empty hint                    → behavior.md §URL check
- [ ] B11 The check needs the Datastar header                       → behavior.md §URL check
- [ ] B12 Suggestions match the last token                          → behavior.md §Tag suggestions
- [ ] B13 Already typed names are excluded                          → behavior.md §Tag suggestions
- [ ] B14 An empty last token suggests nothing                      → behavior.md §Tag suggestions
- [ ] B15 Suggestions cap at ten                                    → behavior.md §Tag suggestions
- [ ] B16 Picking a suggestion completes the token                  → behavior.md §Tag suggestions
- [ ] B17 The edit form is prefilled                                → behavior.md §Edit bookmark
- [ ] B18 Saving updates the bookmark                               → behavior.md §Edit bookmark
- [ ] B19 Changing the URL onto another bookmark is refused         → behavior.md §Edit bookmark
- [ ] B20 Unknown bookmark                                          → behavior.md §Edit bookmark
- [ ] B21 Bookmarklet on the settings page                          → behavior.md §Entry points
- [ ] B22 Links from the list                                       → behavior.md §Entry points
- [ ] B23 Forms need a session                                      → behavior.md §Entry points

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Commit the Datastar 1.0.3 bundle at public/static/datastar.js and add the SDK dependency
- [ ] C2  src/datastar.ts helpers
- [ ] C3  suggestTags and saveBookmark query functions

## Docs
- [ ] D1  Write docs/capabilities/bookmark-form.md
