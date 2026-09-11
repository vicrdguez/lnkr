# Tasks — import-export-netscape

## Behavioral
- [ ] B1  Export downloads the Netscape file                         → behavior.md §Export
- [ ] B2  Export entries carry every attribute                       → behavior.md §Export
- [ ] B3  Archived Bookmarks get the marker tag                      → behavior.md §Export
- [ ] B4  A Shared Bookmark exports as not private                   → behavior.md §Export
- [ ] B17 Entries without a description have no DD line              → behavior.md §Export
- [ ] B5  Export is oldest first                                     → behavior.md §Export
- [ ] B6  A Bookmark without a title exports its URL as the title    → behavior.md §Export
- [ ] B7  Import creates Bookmarks from a linkding export            → behavior.md §Import
- [ ] B8  The marker tag is not stored as a tag                      → behavior.md §Import
- [ ] B9  Re-import changes nothing                                  → behavior.md §Import
- [ ] B10 An existing URL is updated and tags merged                 → behavior.md §Import
- [ ] B11 The private flag maps to Shared only when asked (outline)  → behavior.md §Import
- [ ] B12 Invalid URLs are skipped                                   → behavior.md §Import
- [ ] B13 Missing attributes get defaults                            → behavior.md §Import
- [ ] B14 Folders are ignored                                        → behavior.md §Import
- [ ] B15 A missing file is refused                                  → behavior.md §Import
- [ ] B16 Export of an imported fixture equals the fixture           → behavior.md §Round trip

## Chores
- [ ] C1  Author test/fixtures/linkding-export.html in the exact format

## Docs
- [ ] D1  Write docs/capabilities/import-export.md
