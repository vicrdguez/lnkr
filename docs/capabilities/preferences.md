# Preferences

A person tunes how the web app looks and behaves from the General section of the settings page; the Tenant's choices are kept together and reported to the browser extension through the profile.

## Behaviors
- The General form shows every preference at its stored value, and saving it replaces them all. A value that is not allowed, such as an unknown theme, fewer than ten items per page or fewer than one description line, takes its default instead of failing.
- Theme `auto`, `light` or `dark` sets the page's palette; `auto` follows the system's light or dark setting.
- In the active and Archived lists: the date the Bookmark was added shows relative to now, as `YYYY-MM-DD`, or not at all; the description shows inline with the Tags or on its own line, clamped to a chosen number of lines; titles open in a new tab or the same one; the URL can show under the title; the Edit link, the Archive or Unarchive button and the Delete button can each be hidden; Notes can start open.
- The number of Bookmarks per page, thirty by default and at least ten, pages both lists.
- Lax Tag search makes a bare search term also match a Tag named exactly that term, regardless of case, in the lists and in the REST API; strict Tag search, the default, matches Tags only through `#name`.
- The Tag sidebar groups Tags under the upper-cased first letter, with `#` for anything else, unless grouping is disabled.
- Sticky pagination keeps the page links in view while scrolling; a collapsed side panel hides the Tag sidebar behind a "Show tags" link.
- Default mark unread checks Unread on the new-bookmark form; the REST API and the edit form are unaffected.
- Custom CSS is served at `/custom_css` as `text/css` with a thirty-day cache lifetime and linked after the base stylesheet with a hash of its content, so a change reaches the browser at once; empty CSS is not linked.
- The search form's Save button stores the current sort and Unread filter; the lists use them whenever the query leaves `sort` or `unread` out, and an explicit empty `unread=` shows every Bookmark.
- `GET /api/user/profile/` reports the stored theme, date display, link target, Tag search, URL display, permanent Notes, Favicons and search preferences.

## Out of scope
- Sharing defaults and the Web Archive integration setting
- The REST API's own page size
