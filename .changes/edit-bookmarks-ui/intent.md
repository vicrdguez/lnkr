# Add and edit bookmarks in the UI

## Why
The extension covers the browser, but a person also pastes links from elsewhere, fixes titles, changes tags and rewrites Notes. The bookmarklet needs a page to land on. Until now there is no form.

## What
A new-bookmark page and an edit page sharing one form, prefilled from query parameters so the bookmarklet and the share target can hand over a URL, with an `auto_close` flow that ends on a page that closes itself. While the URL is typed, or when it arrives prefilled, the page asks the server whether the URL is already bookmarked and fills the form from the existing Bookmark or from the page's metadata. The tags field suggests existing tag names. This is the first slice with Datastar: the bundle is served from `public/static/`, and the check and suggestion fragments answer Server-Sent Events through the official SDK. Saving stays a plain form POST. The settings page gains the bookmarklet link, the list gains Edit links and an Add link.

## Scope
- Datastar 1.0.3 bundle at `public/static/datastar.js`, loaded by the layout; `@starfederation/datastar-sdk` `/web` build as the SSE writer; `src/datastar.ts` helpers
- `GET /bookmarks/new`: form with `url`, `title`, `description`, `notes`, `tags` (space-separated), `unread` checkbox; prefilled from `url`, `title`, `description`, `notes`, `tags` query parameters; `auto_close` carried as a hidden field
- `POST /bookmarks/new`: validates the URL, creates the Bookmark or updates the one with that URL, then redirects to `/bookmarks/close` when `auto_close` is set, otherwise to `/bookmarks`
- `GET /bookmarks/close`: a page saying the window can be closed, with the one inline script allowed in the project, `window.close()`
- `GET /bookmarks/<id>/edit` and `POST /bookmarks/<id>/edit`: same form; a URL belonging to another Bookmark is refused; success redirects to `/bookmarks`
- `GET /bookmarks/check`: Datastar action; reads the form signals, answers SSE that patches `#url-hint` with the duplicate notice or nothing, and patches signals with the existing Bookmark's fields, or with page metadata for empty title and description only
- `GET /bookmarks/tags/suggest`: Datastar action; reads the `tags` signal, answers SSE patching `#tag-suggestions` with up to ten tag names starting with the last typed token, excluding names already typed; clicking one completes the token
- The check runs on page load when a URL is prefilled and on URL input with a 500 ms debounce; suggestions run on tags input with a 300 ms debounce
- Bookmarklet section on `/settings` with a `javascript:` link opening `/bookmarks/new` with the page's URL and title and `auto_close`
- `Add bookmark` link in the nav and an `Edit` link on every list item
- CSRF on the form posts; the Datastar actions require the `Datastar-Request` header and answer 400 without it

## Out of Scope
- Archiving, deleting, bulk actions, per-item actions of any kind
- Scraping on form POST; metadata only reaches the form through the check
- Auto-tagging, sharing, the details modal
- Preferences for default unread or link target

## Definition of Done
- [x] The new-bookmark form renders with its fields, prefilled from the query parameters, and carries the Datastar signals for the form.
- [x] Submitting a valid new URL creates the Bookmark with the given fields and tags and redirects to `/bookmarks`; with `auto_close` it redirects to `/bookmarks/close`, which shows the closing message.
- [x] Submitting a URL that already exists updates that Bookmark instead of creating a second one.
- [x] An invalid URL answers 400 with the form, an error and nothing saved.
- [x] The check for an existing URL patches the duplicate notice with a link to the edit page and patches every form signal from the Bookmark.
- [x] The check for a new URL patches an empty hint and fills only empty title and description from the page's metadata, leaving typed values alone.
- [x] Tag suggestions match the last typed token case-insensitively, exclude already typed names, and cap at ten.
- [x] The edit form is prefilled from the Bookmark; saving updates fields and tags and redirects to `/bookmarks`; a URL taken by another Bookmark answers 400 with the form and an error.
- [x] Datastar actions without the `Datastar-Request` header answer 400; all form and action routes need a session.
- [x] The settings page shows the bookmarklet link and list items show an Edit link.

## Manual verification
- [ ] In a browser at `wrangler dev`, type a URL and watch the title fill in, type a tag prefix and pick a suggestion, save, then edit the same Bookmark.
- [ ] Drag the bookmarklet to the bookmarks bar, click it on any page, save, and see the window close.
