# Tasks — stand-up-tenant

## Behavioral  (one per scenario → a red-green cycle)
- [x] B1  Setup form is offered on a fresh Instance                → behavior.md §First-run setup
- [x] B2  Setup creates the user and starts a session               → behavior.md §First-run setup
- [x] B3  Setup rejects missing fields                              → behavior.md §First-run setup
- [x] B4  Setup is closed once a user exists                        → behavior.md §First-run setup
- [x] B5  Protected page redirects to login                         → behavior.md §Password login
- [x] B6  Correct credentials start a session                       → behavior.md §Password login
- [x] B7  Secure flag follows the request scheme                    → behavior.md §Password login
- [x] B8  Same-origin next path is honoured                         → behavior.md §Password login
- [x] B9  Next pointing at another origin is ignored                → behavior.md §Password login
- [x] B10 Wrong credentials are refused                             → behavior.md §Password login
- [x] B11 Root redirects by session                                 → behavior.md §Password login
- [x] B12 Sixth attempt is refused even with the right password     → behavior.md §Login attempt limiter
- [x] B13 The lock ends with the window                             → behavior.md §Login attempt limiter
- [x] B14 A successful login resets the count                       → behavior.md §Login attempt limiter
- [x] B15 Logout ends the session                                   → behavior.md §Session lifecycle
- [x] B16 Expired session is rejected                               → behavior.md §Session lifecycle
- [x] B17 Password changes with the current password                → behavior.md §Change password
- [x] B18 Wrong current password is rejected                        → behavior.md §Change password
- [x] B19 Mismatched confirmation is rejected                       → behavior.md §Change password
- [x] B20 Form POST from another origin is refused                  → behavior.md §Cross-site form protection
- [x] B21 Health is public                                          → behavior.md §Health
- [x] B22 Migrations apply once                                     → behavior.md §Schema migrations

## Chores  (non-behavioral work: migrations, wiring, config)
- [x] C1  Scaffold package.json, tsconfig.json, wrangler.jsonc, vitest.config.ts, worker-configuration.d.ts, public/static/style.css
- [x] C2  test/setup.ts, test/network.ts, test/helpers.ts
- [x] C3  Tenant class, migration runner, schema version 1, createApp wiring
- [x] C4  Layout view and base stylesheet

## Docs
- [x] D1  Write docs/capabilities/tenant-login.md (setup, login, logout, limiter, change password, health)
