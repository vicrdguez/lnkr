# Import and export Netscape bookmarks

## Why
People arriving from linkding, or leaving lnkr, need their Bookmarks to travel. linkding reads and writes the Netscape bookmark file every browser understands, with its own attributes for read state, archive state and Notes. lnkr must round-trip that file so a linkding export imports whole and an lnkr export imports back into linkding.

## What
An export link on the settings page that downloads the Tenant's Bookmarks in linkding's Netscape format, and an import form that reads such a file, creating new Bookmarks and updating those whose URL already exists, with an option to map the private flag.

## Scope
- `GET /settings/export` downloads `bookmarks.html` with every Bookmark, oldest first
- Export attributes: `ADD_DATE` and `LAST_MODIFIED` as Unix seconds, `PRIVATE` as `0` when Shared and `1` otherwise, `TOREAD` from Unread, `TAGS` as a comma-separated list with `linkding:bookmarks.archived` appended for Archived Bookmarks, the description in `<DD>` followed by Notes inside `[linkding-notes]...[/linkding-notes]`
- `POST /settings/import` with a multipart `file` and an optional `map_private_flag` checkbox
- Import creates a Bookmark per `<A>` element, taking dates from the attributes, Unread from `TOREAD`, Archived from the marker tag, tags from `TAGS`, description and Notes from `<DD>`; an existing URL is updated and its tags merged
- With `map_private_flag` on, `PRIVATE="0"` sets Shared; otherwise Shared stays false
- Entries whose URL is invalid are skipped and counted
- The result page reports created, updated and skipped counts
- Re-importing the same file changes nothing
- Folders and any markup other than `<A>` and `<DD>` are ignored

## Out of Scope
- Importing from browsers' native exports beyond what the Netscape structure gives (dates and tags are read when present)
- Background or chunked import; the whole file is handled in one request
- Export filtering by search or tag

## Definition of Done
- [x] Export downloads a file in linkding's exact format with one entry per Bookmark, oldest first, including archived ones.
- [x] Unread, Archived, tags, description and Notes survive an export followed by an import into a fresh Tenant.
- [x] Importing a linkding export creates Bookmarks with the file's dates, tags, read state, archive state, description and Notes.
- [x] Importing a file whose URLs already exist updates those Bookmarks, merges tags and creates no duplicates.
- [x] On import the private flag is ignored unless the mapping option is on, in which case `PRIVATE="0"` marks the Bookmark Shared; on export a Shared Bookmark writes `PRIVATE="0"` and any other `PRIVATE="1"`.
- [x] Invalid URLs are skipped and reported; the rest of the file imports.
- [x] The result page shows the created, updated and skipped counts.
- [x] HTML entities in titles, descriptions and Notes are decoded on import and encoded on export.

## Manual verification
- [ ] Export from a real linkding instance, import into lnkr under `wrangler dev`, export from lnkr, import that file back into linkding and compare counts and a few entries.
