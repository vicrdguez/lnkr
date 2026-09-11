# Tasks — administer-users

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  A superuser sees the page and the link                  → behavior.md §Access to the admin page
- [ ] B2  A non-superuser is refused                              → behavior.md §Access to the admin page
- [ ] B3  Every admin route is refused to non-superusers          → behavior.md §Access to the admin page
- [ ] B4  Anonymous visitors are sent to login                    → behavior.md §Access to the admin page
- [ ] B5  Creating a user provisions a Tenant                     → behavior.md §Create users
- [ ] B6  Invalid input is refused                                → behavior.md §Create users
- [ ] B7  The new password replaces the old one                   → behavior.md §Reset password
- [ ] B8  An empty password is refused                            → behavior.md §Reset password
- [ ] B9  Granting and revoking                                   → behavior.md §Superuser flag
- [ ] B10 A superuser cannot demote themselves                    → behavior.md §Superuser flag
- [ ] B11 Deleting a user wipes their Tenant                      → behavior.md §Delete users
- [ ] B12 A deleted username can be created again                 → behavior.md §Delete users
- [ ] B13 A superuser cannot delete themselves                    → behavior.md §Delete users
- [ ] B14 Unknown user                                            → behavior.md §Delete users
- [ ] B15 Settings are shown and saved                            → behavior.md §Instance settings
- [ ] B16 Invalid settings fall back                              → behavior.md §Instance settings
- [ ] B17 The legacy main Tenant is a superuser                   → behavior.md §Mirror of the superuser flag

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Tenant migration 6: users.is_superuser; setSuperuser at setup and legacy registration
- [ ] C2  Directory and Tenant RPC methods

## Docs
- [ ] D1  Write docs/capabilities/administration.md
