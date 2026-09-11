# Act on bookmarks from the list

## Why
Reading through a list means archiving what is done, deleting what is dead and marking what was read, one item at a time or many at once. Today the list is read-only and every change needs the API or the edit page.

## What
Per-item actions on both list pages, Archive or Unarchive, Delete with a confirmation, and Mark read, each patching the list and sidebar in place. A bulk bar with a checkbox per item, select all on the page, select across every page of the current result, and bulk archive, unarchive, delete, tag, untag, read and unread. Every action is a Datastar POST answering Server-Sent Events; the page's query parameters travel as signals so the server re-renders exactly the view the person is looking at.

## Scope
- Page signals on the list: `q`, `sort`, `unread`, `page`, `selected` (map of item key to boolean), `selectAcross`, `bulkTags`
- Per-item buttons: Archive on `/bookmarks`, Unarchive on `/bookmarks/archived`, Delete with `confirm()`, Mark read when unread
- `POST /bookmarks/<id>/archive`, `/unarchive`, `/delete`, `/read`: apply, then answer SSE patching `#bookmark-list` and `#sidebar` re-rendered for the page's signals
- Bulk bar `#bulk-bar`: selected count, Select all on page, Select across all pages shown once the page is fully selected, action buttons, a tags input for tag and untag
- `POST /bookmarks/bulk` with signals `action`, `selected`, `selectAcross`, `bulkTags` plus the page signals: applies to the selected ids or, with `selectAcross`, to every Bookmark matching the page's filter; answers SSE patching `#bookmark-list`, `#sidebar`, `#bulk-bar` and resetting `selected`, `selectAcross` and `bulkTags`
- Bulk actions: `archive`, `unarchive`, `delete`, `tag`, `untag`, `read`, `unread`
- When the page number is past the last page after the change, the last page is rendered and the `page` signal patched
- Actions require the `Datastar-Request` header and a JSON body; ids in bulk pass through one JSON array parameter
- Unknown bookmark ids answer 404

## Out of Scope
- Share and unshare, bulk refresh, bulk snapshot
- Keyboard shortcuts, undo, toasts
- Actions from the edit page or the API, which already exist

## Definition of Done
- [ ] Archive, Unarchive, Delete and Mark read buttons render on the right pages and each POST applies the change and answers SSE with the re-rendered list and sidebar for the same query.
- [ ] After an action on the last item of the last page, the response renders the previous page and patches the `page` signal.
- [ ] Bulk archive, unarchive, delete, read and unread apply to exactly the selected ids.
- [ ] Bulk tag adds the given names to every selected Bookmark, creating tags as needed; bulk untag removes them; other tags are untouched.
- [ ] With select across, a bulk action applies to every Bookmark matching the current search, unread filter and archived state, and to nothing else.
- [ ] The bulk response resets `selected`, `selectAcross` and `bulkTags` and re-renders the bulk bar.
- [ ] The list page carries the page signals and the bulk bar markup; item checkboxes bind to `selected`.
- [ ] Actions without the Datastar header or with a form body answer 400; unknown ids answer 404; all need a session.

## Manual verification
- [ ] In a browser at `wrangler dev`, archive an item and see it leave the list without a reload, select three items, tag them, and see the selection clear.
