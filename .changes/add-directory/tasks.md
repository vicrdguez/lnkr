# Tasks — add-directory

## Behavioral
- [ ] B1  Setup creates the superuser and a Tenant                     → behavior.md §Setup on a fresh Instance
- [ ] B2  Setup closes after the first user                            → behavior.md §Setup on a fresh Instance
- [ ] B3  The Tenant no longer offers setup                            → behavior.md §Setup on a fresh Instance
- [ ] B4  First Directory request registers main                       → behavior.md §Registering a pre-existing main Tenant
- [ ] B5  Login for the registered user reaches main                   → behavior.md §Registering a pre-existing main Tenant
- [ ] B6  A bare session cookie still reaches main                     → behavior.md §Registering a pre-existing main Tenant
- [ ] B7  A bare API token still reaches main                          → behavior.md §Registering a pre-existing main Tenant
- [ ] B8  Setup is closed once main is registered                      → behavior.md §Registering a pre-existing main Tenant
- [ ] B9  Known username reaches its Tenant                            → behavior.md §Login routing
- [ ] B10 Wrong password is refused by the Tenant                      → behavior.md §Login routing
- [ ] B11 Unknown username is refused by the Directory                 → behavior.md §Login routing
- [ ] B12 The Tenant limiter still applies                             → behavior.md §Login routing
- [ ] B13 Same-origin next path is honoured across the routing         → behavior.md §Login routing
- [ ] B14 Prefixed cookie reaches the Tenant                           → behavior.md §Routing by credential prefix
- [ ] B15 Prefixed API token reaches the Tenant                        → behavior.md §Routing by credential prefix
- [ ] B16 Prefixed feed token reaches the Tenant                       → behavior.md §Routing by credential prefix
- [ ] B17 No credential reaches the Directory                          → behavior.md §Routing by credential prefix
- [ ] B18 Health is served without a credential                        → behavior.md §Routing by credential prefix
- [ ] B19 Root without a credential goes to login                      → behavior.md §Routing by credential prefix
- [ ] B20 Forged prefixes hit an unprovisioned Tenant and get 404      → behavior.md §Routing by credential prefix
- [ ] B21 A malformed prefix is treated as no credential               → behavior.md §Routing by credential prefix
- [ ] B22 Bookmarks are private to their Tenant                        → behavior.md §Isolation between Tenants
- [ ] B23 A session from one Tenant cannot be replayed against another → behavior.md §Isolation between Tenants
- [ ] B24 Directory migrations apply once                              → behavior.md §Directory storage

## Chores
- [ ] C1  wrangler.jsonc: DIRECTORY binding, migration tag v2, regenerate worker-configuration.d.ts
- [ ] C2  src/auth/credential.ts and prefix handling in session, token and feed lookups
- [ ] C3  Move login and setup form markup into src/views/auth.tsx
- [ ] C4  Test helper: provisionLegacyMain(username, password) and setupInstance(username, password)

## Docs
- [ ] D1  Create docs/capabilities/tenancy.md
