# Tasks — add-directory

## Behavioral
- [x] B1  Setup creates the superuser and a Tenant                     → behavior.md §Setup on a fresh Instance
- [x] B2  Setup closes after the first user                            → behavior.md §Setup on a fresh Instance
- [x] B3  The Tenant no longer offers setup                            → behavior.md §Setup on a fresh Instance
- [x] B4  First Directory request registers main                       → behavior.md §Registering a pre-existing main Tenant
- [x] B5  Login for the registered user reaches main                   → behavior.md §Registering a pre-existing main Tenant
- [x] B6  A bare session cookie still reaches main                     → behavior.md §Registering a pre-existing main Tenant
- [x] B7  A bare API token still reaches main                          → behavior.md §Registering a pre-existing main Tenant
- [x] B8  Setup is closed once main is registered                      → behavior.md §Registering a pre-existing main Tenant
- [x] B9  Known username reaches its Tenant                            → behavior.md §Login routing
- [x] B10 Wrong password is refused by the Tenant                      → behavior.md §Login routing
- [x] B11 Unknown username is refused by the Directory                 → behavior.md §Login routing
- [x] B12 The Tenant limiter still applies                             → behavior.md §Login routing
- [x] B13 Same-origin next path is honoured across the routing         → behavior.md §Login routing
- [x] B14 Prefixed cookie reaches the Tenant                           → behavior.md §Routing by credential prefix
- [x] B15 Prefixed API token reaches the Tenant                        → behavior.md §Routing by credential prefix
- [x] B16 Prefixed feed token reaches the Tenant                       → behavior.md §Routing by credential prefix
- [x] B17 No credential reaches the Directory                          → behavior.md §Routing by credential prefix
- [x] B18 Health is served without a credential                        → behavior.md §Routing by credential prefix
- [x] B19 Root without a credential goes to login                      → behavior.md §Routing by credential prefix
- [x] B20 Forged prefixes hit an unprovisioned Tenant and get 404      → behavior.md §Routing by credential prefix
- [x] B21 A malformed prefix is treated as no credential               → behavior.md §Routing by credential prefix
- [x] B22 Bookmarks are private to their Tenant                        → behavior.md §Isolation between Tenants
- [x] B23 A session from one Tenant cannot be replayed against another → behavior.md §Isolation between Tenants
- [x] B24 Directory migrations apply once                              → behavior.md §Directory storage

## Chores
- [x] C1  wrangler.jsonc: DIRECTORY binding, migration tag v2, regenerate worker-configuration.d.ts
- [x] C2  src/auth/credential.ts and prefix handling in session, token and feed lookups
- [x] C3  Move login and setup form markup into src/views/auth.tsx
- [x] C4  Test helper: provisionLegacyMain(username, password) and setupInstance(username, password)

## Docs
- [x] D1  Create docs/capabilities/tenancy.md
