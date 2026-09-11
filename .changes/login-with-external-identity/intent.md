# Log in with an external identity

## Why
A shared Instance should not mean another password. linkding supports OpenID Connect and an auth proxy header; on Cloudflare the proxy is Cloudflare Access. Both end the same way: a verified identity becomes a user, and the user gets a session.

## What
OpenID Connect authorization code flow with PKCE on the Directory, with the username taken from a configurable claim, and Cloudflare Access verification of the `Cf-Access-Jwt-Assertion` header for requests that carry no lnkr credential. A verified identity that has no user yet is created and provisioned, then a session cookie is set and ordinary routing takes over. The password form can be disabled.

## Scope
- Variables `LD_ENABLE_OIDC`, `OIDC_OP_DISCOVERY_ENDPOINT`, `OIDC_RP_CLIENT_ID`, `OIDC_USERNAME_CLAIM` (default `email`), `LD_DISABLE_LOGIN_FORM`, `LD_ACCESS_TEAM_DOMAIN`, `LD_ACCESS_AUD`; secret `OIDC_RP_CLIENT_SECRET`
- `GET /oidc/login` on the Directory: discovery, PKCE verifier and state kept in a short-lived cookie, redirect to the provider
- `GET /oidc/callback`: state check, code exchange, ID token validation through `openid-client`, username from the claim, user lookup or creation, Tenant session, cookie, redirect to `/`
- `GET /login` shows a "Log in with OpenID Connect" link when OIDC is enabled and hides the password form when `LD_DISABLE_LOGIN_FORM` is set; `POST /login` answers 403 when the form is disabled
- Cloudflare Access: when both Access variables are set and a request without an lnkr credential carries the header, the JWT is verified against the team's JWKS, the `email` claim becomes the username, the user is created when missing, a session is started and the request redirects to itself with the cookie set
- Users created from an external identity have no password; password login for them answers 401 like a wrong password
- Discovery documents and JWKS cached in memory for an hour per Directory instance

## Out of Scope
- Linking an external identity to an existing password user by anything but username equality
- Logout at the provider, refresh tokens, groups or role claims
- Access service tokens for the API; API tokens stay the only API credential
- Auto-created users becoming superusers

## Definition of Done
- [ ] With OIDC enabled, the login page offers the OIDC link and `/oidc/login` redirects to the provider's authorization endpoint with `code_challenge`, `state`, the client id and the callback URL.
- [ ] A valid callback creates the user when missing, provisions their Tenant, starts a session with the prefixed cookie and redirects to `/`; a later callback for the same identity reuses the user.
- [ ] A callback with a wrong state, a failed token exchange or an ID token that does not verify answers 400 and sets no cookie.
- [ ] With the login form disabled, the page has no password form and `POST /login` answers 403, while OIDC still works.
- [ ] A request carrying a valid Access JWT and no lnkr credential gets a session for the `email` identity and is redirected to the same path; an invalid, expired or wrong-audience JWT is ignored and the request proceeds as anonymous.
- [ ] An identity-created user cannot log in with a password.
- [ ] Every existing password login scenario still passes when the variables are unset.

## Manual verification
- [ ] Configure a real provider such as Authentik or Google against `wrangler dev` with the callback URL and log in end to end.
- [ ] Put the deployed Instance behind Cloudflare Access with the audience tag and confirm a first visit lands logged in.
