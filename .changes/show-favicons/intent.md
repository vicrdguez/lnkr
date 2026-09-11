# Show favicons

## Why
A list of bare titles is slow to scan. linkding shows each site's icon next to its Bookmarks, which makes the list readable at a glance. lnkr stores nothing for this: the browser loads each icon from a favicon provider.

## What
A Favicons toggle on the settings page, off by default. When on, every Bookmark in the list carries a small icon whose source is the provider URL template from the `LD_FAVICON_PROVIDER` variable with the Bookmark's origin filled in. The profile endpoint reports the toggle.

## Scope
- `prefs.enable_favicons` boolean, default false, saved by POST `/settings/favicons` from a checkbox on the settings page
- Wrangler var `LD_FAVICON_PROVIDER` with linkding's default template; `{url}` is replaced with the URL-encoded origin of the Bookmark
- The bookmark list renders `<img class="favicon">` before the title of every item when the toggle is on, and nothing when it is off
- `GET /api/user/profile/` returns `enable_favicons` from the preference
- Settings help text says the browser fetches icons from the provider and therefore reveals bookmarked hosts to it

## Out of Scope
- Caching icons in R2 or serving them from lnkr
- The `favicon_url` API field, which stays null
- Icons anywhere except the bookmark list

## Definition of Done
- [ ] The settings page shows the toggle in its current state and saving changes it.
- [ ] With the toggle off, no list item contains a favicon image.
- [ ] With the toggle on, every list item contains an image whose `src` is the provider template with the Bookmark's encoded origin, and only the origin.
- [ ] The provider template comes from `LD_FAVICON_PROVIDER`.
- [ ] `user/profile` reports the toggle's value.

## Manual verification
- [ ] Turn the toggle on under `wrangler dev` and see real icons next to a few Bookmarks.
