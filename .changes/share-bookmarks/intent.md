# Share bookmarks

## Why
The Shared flag has existed since the first API slice with no effect. On a multi-Tenant Instance, sharing is how people pass links to each other, and public sharing is how an Instance publishes a reading list. The extension already shows a Share checkbox when the profile says sharing is on.

## What
Sharing preferences per Tenant, per-item and bulk share actions, a shared index kept in the Directory so a page can list shared Bookmarks across Tenants, the `/bookmarks/shared` page for logged-in users and, for public rows, for anonymous visitors, the shared feeds, and the landing page and guest profile settings taking effect.

## Scope
- Preferences `enable_sharing`, `enable_public_sharing`, `default_mark_shared` in a Sharing section of the settings page
- Directory table `shared_bookmarks` and RPC `upsertShared`, `removeShared`, `replaceShared`, `listShared`
- The Tenant writes the index after every change to a Bookmark's shared state or content, on delete, and replaces its entries when the sharing preferences change; a Re-sync button on settings replaces them by hand
- Per-item Share and Unshare buttons and bulk `share` and `unshare` when sharing is on; `shared=yes|no` filter on the own list pages
- `GET /bookmarks/shared`: list with owner username per item, `q` matching title, description and URL substrings, `user` filter, pagination at thirty, sort newest first, no actions; served to logged-in users from their Tenant and to anonymous visitors from the Directory with public rows only
- `GET /feeds/shared` public and `GET /feeds/<token>/shared` for all shared rows, with `q` and `limit`
- Landing page `shared_bookmarks` sends anonymous visitors from `/` to `/bookmarks/shared`; the guest profile user's theme, link target and date display style the anonymous page
- `GET /api/user/profile/` reports the real `enable_sharing` and `enable_public_sharing`
- The new-bookmark form gets a Shared checkbox preselected by `default_mark_shared`

## Out of Scope
- Sharing tags or Bundles, comments, per-user visibility
- Search grammar on the shared page beyond substrings
- Removing a Tenant's index rows when the Tenant is deleted, beyond the wipe that already 404s them: administer-users deletion also calls `replaceShared` with an empty list

## Definition of Done
- [ ] The Sharing section saves the three preferences and the profile reports the two flags.
- [ ] With sharing on, marking a Bookmark shared, through the API, the form, the item button or bulk, makes it appear on `/bookmarks/shared` for another logged-in Tenant with the owner's username; unsharing, deleting or turning sharing off removes it.
- [ ] Edits to a shared Bookmark's title, description, tags or URL are reflected on the shared page.
- [ ] Anonymous visitors see only Bookmarks of Tenants with public sharing on; turning it off hides them.
- [ ] `q` and `user` filter the shared page and pagination works across Tenants.
- [ ] `/feeds/shared` lists public rows and `/feeds/<token>/shared` lists all shared rows.
- [ ] Landing page `shared_bookmarks` redirects anonymous `/` to the shared page; the guest profile user's display preferences apply there.
- [ ] Re-sync rebuilds a Tenant's index rows from its Bookmarks.

## Manual verification
- [ ] With two users, share a Bookmark from the extension popup and see it on the other user's shared page.
