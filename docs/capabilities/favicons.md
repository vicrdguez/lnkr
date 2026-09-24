# Favicons

A person turns on site icons next to the Bookmarks in the list, loaded by their browser from a favicon provider; lnkr stores nothing for this.

## Behaviors
- The settings page has a Favicons toggle, off by default; saving it changes the preference for the Tenant.
- With the toggle on, every Bookmark in the active and Archived lists carries a small icon before its title. The icon's source is the provider URL template from the `LD_FAVICON_PROVIDER` variable with `{url}` replaced by the Bookmark's URL-encoded origin, never its full URL, so the provider learns hosts only. A Bookmark whose URL does not parse gets no icon.
- With the toggle off, the list contains no icons.
- The settings page says the browser fetches the icons from the provider and therefore reveals bookmarked hosts to it.
- `GET /api/user/profile/` reports the toggle as `enable_favicons`.

## Out of scope
- Caching icons or serving them from lnkr
- The API's `favicon_url` field, which stays null
- Icons anywhere except the bookmark list
