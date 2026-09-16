# Bookmark actions

A person acts on Bookmarks straight from the list: archive, unarchive, delete and mark read one at a time, or select many and archive, unarchive, delete, tag, untag, mark read or mark unread at once, with the list updating in place.

## Behaviors
- Every Bookmark on the active list has Archive, Delete and, while Unread, Mark read buttons; on the archive, Unarchive replaces Archive. Delete asks for confirmation first. Each button posts to the server, which applies the change and answers with the list, its pagination, the Tag sidebar and the bulk bar re-rendered for the page's own search, sort, Unread filter and page number, so the view updates without a reload.
- When an action empties the last page, the previous page is shown and the page number follows.
- A bulk bar above the list shows how many Bookmarks are selected, a checkbox per Bookmark, Select all for the page and, once every Bookmark on the page is selected, Select across all pages, which extends the action to every Bookmark matching the current search, Unread filter and list, active or archived, on every page.
- Bulk Archive or Unarchive, Delete after confirmation, Mark read and Mark unread apply to exactly the selected Bookmarks. Tag attaches every name typed in the tags box, separated by spaces, creating Tags that do not exist yet; Untag detaches those names regardless of case; other Tags are untouched. Any number of Bookmarks can be selected at once.
- After a bulk action the selection, Select across and the tags box are cleared and the bar re-rendered; with nothing selected the action changes nothing.
- The page's query travels with every action as Datastar signals, so the server re-renders exactly the view the person is looking at.
- Actions need a session and answer only Datastar requests carrying a JSON body; anything else is refused. An unknown Bookmark answers not found and an unknown bulk action is refused.

## Out of scope
- Share and unshare, bulk refresh, bulk Snapshots
- Keyboard shortcuts, undo, toasts
- Working without JavaScript: browsing does, the actions need the Datastar runtime
