# Bookmark list

A person browses the Tenant's Bookmarks in the web app: the active list and the archive, searched with the query grammar, sorted, filtered to Unread, thirty to a page, with a Tag sidebar and a Web Archive link on every Bookmark.

## Behaviors
- `/bookmarks` lists active Bookmarks and `/bookmarks/archived` lists Archived ones, newest first, thirty to a page. `/` sends a logged-in visitor to the list; both pages need a session and send visitors without one to login, remembering where they were going.
- Each Bookmark shows its title linking to its URL in a new tab, or the URL when the title is empty; its description; its Tags as links that search for them; its Notes as plain text behind a "Notes" toggle with line breaks kept; and when it was added, relative to now with the exact time as a tooltip, linking to the Internet Archive's copy from that moment. Unread Bookmarks are marked.
- The search box takes the query grammar and keeps its value; Clear empties it. Sort by date added or title in either direction, newest first by default; Unread keeps only Unread Bookmarks. Searching keeps the sort and the filter, and a query that does not parse finds nothing.
- Previous and Next move between pages and a label shows the position; page links keep the search, sort and filter; a page past the end shows the last page.
- The sidebar lists every Tag on the Bookmarks matching the current search and filter, across all pages, with how many carry it, ordered by name. Clicking a Tag adds `#name` to the search; a Tag already in the search is marked and clicking it takes it out.
- An empty Tenant says so, as does a search that finds nothing.
- The nav shows Bookmarks, Archived, Settings and Log out and marks the current section.
- Everything works without JavaScript: the controls are links and one GET form.

<!-- DEBT(#27/W3): stale since #27: the nav also has Add bookmark, every item has an Edit link, and creating and editing from the UI moved into bookmark-form.md. -->

## Out of scope
- Creating and editing from the UI
- Display preferences: items per page, description modes, date display, link target, Tag grouping are fixed
- Preview images, Snapshots, Bundles, keyboard shortcuts
