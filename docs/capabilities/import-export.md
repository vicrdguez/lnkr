# Import and export

A person moves their Bookmarks in and out of lnkr as the Netscape bookmark file linkding and browsers read, so a linkding export imports whole and an lnkr export imports back into linkding.

## Behaviors
- The settings page has an Export link that downloads `bookmarks.html` with every Bookmark, Archived ones included, oldest first, in linkding's exact format: `ADD_DATE` and `LAST_MODIFIED` as Unix seconds, `PRIVATE` `0` for a Shared Bookmark and `1` otherwise, `TOREAD` from Unread, `TAGS` as the Tag names ordered by name with `linkding:bookmarks.archived` appended for an Archived Bookmark, and a `<DD>` line carrying the description followed by the Notes inside `[linkding-notes]…[/linkding-notes]`, written only when there is text for it. A Bookmark without a title writes its URL as the title. Text and attributes are HTML-escaped.
- The settings page has an Import form taking a Netscape file. Every `<A>` becomes a Bookmark with the file's dates, Unread from `TOREAD`, Archived from the marker tag, which is never stored as a Tag, Tags from `TAGS`, and the description and Notes from the `<DD>` that follows; entities are decoded. A missing `ADD_DATE` is the time of the import and a missing `LAST_MODIFIED` equals `ADD_DATE`.
- A URL that already exists is updated with the file's fields, keeps its `date_added`, and gains the file's Tags on top of its own; importing the same file twice creates nothing.
- The private flag is ignored unless the "Mark entries with PRIVATE="0" as shared" option is on, in which case `PRIVATE="0"` marks the Bookmark Shared.
- Entries whose URL is not `http` or `https` are skipped; the rest of the file imports. The settings page then reports how many Bookmarks were created, updated and skipped.
- Folders and any markup other than `<A>` and `<DD>` are ignored. A request without a file answers 400.
- The whole file is written in one transaction: an import either lands entirely or not at all.

## Out of scope
- Browser-specific extras beyond the Netscape structure, such as favicon data or folder names as Tags
- Background or chunked import; the whole file is handled in one request
- Export filtering by search or Tag
