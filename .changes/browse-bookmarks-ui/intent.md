# Browse bookmarks in the UI

## Why
Gathering links is the extension's job; finding them again is the web app's. Until now lnkr has no page that lists bookmarks, so a person can save but never see what they saved.

## What
The bookmark list at `/bookmarks` and the archive at `/bookmarks/archived`: a search box using the query grammar, sort, an unread filter, pagination at thirty per page, a tag sidebar with counts for the current result that filters on click, and list items showing title, description, tags, plain-text notes and a relative date that links to the Internet Archive. The root of the site now goes to the list. No JavaScript is needed: notes open with a native `details` element and every control is a link or a GET form.

## Scope
- `GET /bookmarks` and `GET /bookmarks/archived`, session-only, with query parameters `q`, `sort`, `unread`, `page`
- Search form submitting by GET to the same page, keeping `sort` and `unread`, with a Clear link
- Sort options `added_desc` (default), `added_asc`, `title_asc`, `title_desc`
- Unread filter `unread=yes`; anything else means no filter
- Pagination at thirty items with Previous and Next links and a "Page x of y" label; an out-of-range page shows the last page
- Tag sidebar: every tag used by any bookmark in the current result across all pages, with its count, ordered by name; clicking appends `#name` to `q`; tags already in `q` render as selected with a link that removes them
- List item: title linking to the URL, opening in a new tab, falling back to the URL when the title is empty; description; tag links that search `#name`; notes inside a `details` element rendered as escaped text with line breaks preserved; the date as relative text with the absolute time as a tooltip, linking to the Web Archive link built from the bookmark's date added
- Unread items carry the class `unread`; empty states for no bookmarks and for no results
- Navigation: Bookmarks, Archived, Settings, Logout, with the current section marked
- `/` redirects to `/bookmarks`
- Base stylesheet for the list, sidebar and forms

## Out of Scope
- Creating, editing, archiving or deleting from the UI; bulk actions; the Datastar bundle
- Display preferences: items per page, description modes, date display, link target, tag grouping are fixed
- Favicons, preview images, snapshots, bundles
- Keyboard shortcuts

## Definition of Done
- [ ] `/bookmarks` lists active bookmarks newest first with title, description, tags, notes and date; `/bookmarks/archived` lists only archived ones.
- [ ] `q` filters both pages with the query grammar and the search box keeps its value.
- [ ] `sort` orders by date added or title in either direction, defaulting to newest first.
- [ ] `unread=yes` keeps only unread bookmarks.
- [ ] Thirty items per page; Previous and Next move between pages and the label shows the position; an out-of-range page shows the last page.
- [ ] The sidebar lists the tags of the whole filtered result with counts, ordered by name; a tag link adds `#name` to `q`; a selected tag shows a link that removes it.
- [ ] A bookmark's date links to `https://web.archive.org/web/<YYYYMMDDhhmmss>/<url>` derived from its `date_added`.
- [ ] Titles, descriptions, notes and tag names are HTML-escaped; notes keep their line breaks.
- [ ] `/` redirects to `/bookmarks` with a session and to `/login` without; both list pages redirect to `/login?next=` without a session.
- [ ] The nav marks Bookmarks on the list page and Archived on the archive page.

## Manual verification
- [ ] Open the list in a browser at `wrangler dev` with a few dozen bookmarks and check layout, wrapping of long titles and URLs, the sidebar and pagination on a narrow window.
