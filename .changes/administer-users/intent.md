# Administer users

## Why
With the Directory in place an Instance can hold several Tenants, but nothing can create the second one. linkding gives superusers an admin page for exactly this: create and delete users, reset a password, grant superuser, and set Instance-wide options.

## What
An admin page for superusers inside the app, backed by Directory RPC: list users, create a user with a password, delete a user and wipe their Tenant, reset a password, toggle superuser, and edit the Instance settings for the landing page and the guest profile user. The Tenant mirrors the superuser flag so the nav can show the Admin link without a Directory call; every admin action re-checks with the Directory.

## Scope
- Tenant migration adding `users.is_superuser`, mirrored from the Directory through a new Tenant RPC `setSuperuser`; the legacy `main` Tenant is marked superuser at registration and setup marks the first user
- `GET /admin`: table of users with username, superuser flag, joined date; create form; per-user forms for Reset password, Toggle superuser, Delete
- `POST /admin/users` with `username` and `password`: creates the Directory user and provisions its Tenant
- `POST /admin/users/<id>/password` with `password`: writes the new hash into that user's Tenant
- `POST /admin/users/<id>/superuser`: toggles the flag, refused on oneself
- `POST /admin/users/<id>/delete`: wipes the Tenant's storage and removes the Directory row, refused on oneself
- `POST /admin/settings` with `landing_page` (`login` or `shared_bookmarks`) and `guest_profile_user_id`; stored in the Directory; their effect on anonymous visitors arrives with share-bookmarks
- Directory RPC: `listUsers`, `createUser`, `deleteUser`, `setSuperuser`, `resetPassword`, `isSuperuser`, `getSettings`, `updateSettings`
- Tenant RPC: `setPassword`, `setSuperuser`, `wipe`
- Non-superusers answer 403 on every `/admin` route; the nav shows Admin only to superusers

## Out of Scope
- Self-service registration, email, password reset by email
- Renaming users or changing tenant keys
- Any effect of the landing page or guest profile settings, which share-bookmarks implements
- Bulk user import

## Definition of Done
- [ ] A superuser sees the Admin link and `/admin` lists every user with flag and date; a non-superuser gets 403 and no link.
- [ ] Creating a user provisions a Tenant the new user can log into, with their own empty bookmarks.
- [ ] Resetting a password makes the new password work and the old one fail for that user.
- [ ] Toggling superuser changes the flag in the Directory and the target Tenant's mirror; a superuser cannot demote themselves.
- [ ] Deleting a user removes them from the list, makes their credentials stop working and their Tenant answer 404, and cannot be applied to oneself.
- [ ] Usernames are unique regardless of case; a duplicate is refused with an error.
- [ ] Instance settings are shown and saved.

## Manual verification
- [ ] Create a second user, log in as them in a private window, save a bookmark, and confirm the first user does not see it.
