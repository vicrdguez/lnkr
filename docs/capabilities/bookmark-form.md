# Bookmark form

A person adds a Bookmark by hand or from the bookmarklet, and edits any Bookmark's fields and Tags, in one form that checks the URL and suggests Tags while they type.

## Behaviors
- `/bookmarks/new` shows the form: URL, title, description, Notes, Tags separated by spaces, and an Unread checkbox. Query parameters prefill the URL, title, description, Notes and Tags, so the bookmarklet and a share target can hand over a page; `auto_close` in the query rides along as a hidden field.
- Saving a valid `http` or `https` URL creates the Bookmark with the given fields and Tags, creating Tags that do not exist yet, and returns to the list. A URL that is already bookmarked updates that Bookmark instead of adding a second one. With `auto_close`, saving lands on a page that closes its own window.
- An invalid or empty URL is refused with the form shown again, the typed values kept and nothing saved.
- While the URL is typed, or on load when it arrives prefilled, the page asks the server about it. A URL that is already bookmarked shows a notice with a link to edit that Bookmark and fills every field from it. A new URL fills only an empty title and description from the page's metadata, leaving typed values alone; an unreachable page fills nothing.
- Typing in the Tags field suggests up to ten existing Tag names starting with the last token regardless of case, leaving out names already typed; picking one completes the token.
- Every Bookmark in the list has an Edit link to the same form, prefilled from the Bookmark. Saving replaces its fields and Tags and returns to the list. Moving its URL onto another Bookmark's URL is refused with the form shown again.
- The nav has an Add bookmark link, and the settings page offers a bookmarklet that opens the form for the current page, title included, and closes the window once saved.
- The form and both live checks need a session. The live checks answer only Datastar requests; saving is an ordinary form submission that works without JavaScript.

## Out of scope
- Archiving, deleting, bulk actions and any other per-item action
- Fetching Page metadata on save; it only reaches the form through the live check
- Sharing, a details view
- Preferences for a default Unread state or link target
