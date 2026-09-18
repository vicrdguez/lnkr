# Tasks — import-export-netscape

## Behavioral
- [x] B1  Export downloads the Netscape file                         → behavior.md §Export
- [x] B2  Export entries carry every attribute                       → behavior.md §Export
- [x] B3  Archived Bookmarks get the marker tag                      → behavior.md §Export
- [x] B4  A Shared Bookmark exports as not private                   → behavior.md §Export
- [x] B17 Entries without a description have no DD line              → behavior.md §Export
- [x] B5  Export is oldest first                                     → behavior.md §Export
- [x] B6  A Bookmark without a title exports its URL as the title    → behavior.md §Export
- [x] B7  Import creates Bookmarks from a linkding export            → behavior.md §Import
- [x] B8  The marker tag is not stored as a tag                      → behavior.md §Import
- [x] B9  Re-import changes nothing                                  → behavior.md §Import
- [x] B10 An existing URL is updated and tags merged                 → behavior.md §Import
- [x] B11 The private flag maps to Shared only when asked (outline)  → behavior.md §Import
- [x] B12 Invalid URLs are skipped                                   → behavior.md §Import
- [x] B13 Missing attributes get defaults                            → behavior.md §Import
- [x] B14 Folders are ignored                                        → behavior.md §Import
- [x] B15 A missing file is refused                                  → behavior.md §Import
- [x] B16 Export of an imported fixture equals the fixture           → behavior.md §Round trip

## Chores
- [x] C1  Author test/fixtures/linkding-export.html in the exact format

## Docs
- [x] D1  Write docs/capabilities/import-export.md
