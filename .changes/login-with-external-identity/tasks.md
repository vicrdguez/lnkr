# Tasks — login-with-external-identity

## Behavioral  (one per scenario → a red-green cycle)
- [ ] B1  The login page offers OIDC                               → behavior.md §Starting the OIDC flow
- [ ] B2  The flow redirects to the provider                       → behavior.md §Starting the OIDC flow
- [ ] B3  OIDC disabled hides the link and the routes              → behavior.md §Starting the OIDC flow
- [ ] B4  A valid callback creates the user and logs in            → behavior.md §Completing the OIDC flow
- [ ] B5  A second login reuses the user                           → behavior.md §Completing the OIDC flow
- [ ] B6  The username claim is configurable                       → behavior.md §Completing the OIDC flow
- [ ] B7  An existing password user with the same name is reused   → behavior.md §Completing the OIDC flow
- [ ] B8  Invalid callbacks are refused                            → behavior.md §Completing the OIDC flow
- [ ] B9  Identity users cannot use a password                     → behavior.md §Completing the OIDC flow
- [ ] B10 The form is hidden and refused                           → behavior.md §Disabled password form
- [ ] B11 A valid Access JWT logs in and redirects                 → behavior.md §Cloudflare Access
- [ ] B12 A request with a session ignores the header              → behavior.md §Cloudflare Access
- [ ] B13 Invalid Access tokens are ignored                        → behavior.md §Cloudflare Access
- [ ] B14 Access is off without the variables                      → behavior.md §Cloudflare Access

## Chores  (non-behavioral work: migrations, wiring, config)
- [ ] C1  Add openid-client; variables in wrangler.jsonc and vitest bindings; wrangler types
- [ ] C2  Test key pair, JWT minting helper and msw handlers for discovery, token, JWKS and Access certs

## Docs
- [ ] D1  Write docs/capabilities/external-identity.md
