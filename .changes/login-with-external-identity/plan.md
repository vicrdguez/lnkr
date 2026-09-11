# Log in with an external identity Plan

## Approach
Both mechanisms run on the Directory, which is where credential-less requests already land, and both end in one function, `loginIdentity(username)`, that finds or creates the Directory user, provisions the Tenant on creation, starts a Tenant session and returns the prefixed cookie. OIDC uses `openid-client` v6, which is built on `oauth4webapi`, Web Crypto and `fetch` and runs on workerd. Access JWT verification is forty lines of Web Crypto. Project conventions come from `.changes/stand-up-tenant/plan.md`; the Directory, its app and RPC from `.changes/add-directory/plan.md`; user creation from `.changes/administer-users/plan.md`.

New and changed files:
```
src/auth/oidc.ts             discovery cache, authorization URL, callback handling
src/auth/access.ts           verifyAccessJwt(token, teamDomain, aud, jwks)
src/auth/identity.ts         loginIdentity(directory sql, env, username, now)
src/directory.ts             /oidc/login, /oidc/callback, Access middleware, login page changes, 403 on disabled form
src/index.ts                 POST /login forwarded to the Directory when the form is disabled
src/db/directory.ts          findOrCreateUser
test/login-with-external-identity.test.ts
```

## Implementation decisions

- **Variables.** Read from `c.env` on the Directory. `LD_ENABLE_OIDC` and `LD_DISABLE_LOGIN_FORM` are on when equal to `True` or `true`. OIDC routes exist only when `LD_ENABLE_OIDC` is on and `OIDC_OP_DISCOVERY_ENDPOINT` and `OIDC_RP_CLIENT_ID` are set; otherwise they answer 404. `OIDC_RP_CLIENT_SECRET` is a wrangler secret. In tests the values come from `cloudflareTest({ miniflare: { bindings } })`; scenarios that need a variable unset use a second Vitest project or `vi.stubEnv` on `env` where the plugin allows it, otherwise the setup registers two configurations; pick the one that works and keep it in `vitest.config.ts`.
- **openid-client.** `discovery(new URL(endpoint), clientId, clientSecret)` cached per Directory instance for one hour by expiry timestamp. Login: `randomPKCECodeVerifier()`, `calculatePKCECodeChallenge()`, `randomState()`, `buildAuthorizationUrl(config, { redirect_uri, scope: "openid email profile", code_challenge, code_challenge_method: "S256", state })`. The verifier and state go into a cookie `oidc` as JSON, `HttpOnly`, `SameSite=Lax`, `Path=/oidc`, `Secure` on https, `Max-Age=600`; the cookie is signed with HMAC-SHA256 using `OIDC_RP_CLIENT_SECRET` as the key so it cannot be forged. Callback: read and verify the cookie, `authorizationCodeGrant(config, currentUrl, { pkceCodeVerifier, expectedState })`, then `tokens.claims()`; the username is `claims[OIDC_USERNAME_CLAIM]` and must be a non-empty string, else 400. Any thrown error answers 400 with the login page and `Login failed`. The redirect URI is always `<origin>/oidc/callback`.
- **`loginIdentity(sql, env, username, now)`.** `findUser(username)` in the Directory; when missing, generate a tenant key, insert the row with `is_superuser` 0, call `tenant.provision(username, "")` on that key; then `tenant.startSession()` and return `formatCredential(key, sessionId)`. Users provisioned with an empty hash are identity users: `verifyPassword` answers false for an empty stored hash, so the Tenant's `POST /login` answers 401 for them without special casing. `findOrCreateUser` wraps the two Directory steps in `transactionSync`; the Tenant RPC happens after.
- **Login page.** The Directory's `LoginForm` gains a link `Log in with OpenID Connect` to `/oidc/login` when OIDC is on, and omits the password form when the form is disabled. The Tenant's own login rendering is unchanged, since the Tenant only receives `POST /login`.
- **Disabled form.** The Worker forwards `POST /login` to the Directory without a lookup when `LD_DISABLE_LOGIN_FORM` is on, and the Directory answers 403 with the login page. `tenantFor` keeps every other rule.
- **Access.** Directory middleware, first in its chain: when `LD_ACCESS_TEAM_DOMAIN` and `LD_ACCESS_AUD` are set and the header `Cf-Access-Jwt-Assertion` is present, call `verifyAccessJwt`. On success, `loginIdentity(email)`, set the cookie with the Tenant's cookie attributes, 302 to the request's own path and query. On failure, continue as anonymous. Requests that carry an lnkr credential never reach the Directory, so a logged-in user is unaffected. `verifyAccessJwt`: parse the compact JWT, require `alg` `RS256`, fetch `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (cached one hour), pick the key by `kid`, import with `crypto.subtle.importKey("jwk", ...)`, verify with `RSASSA-PKCS1-v1_5`, then require `iss` equal to `https://<team>.cloudflareaccess.com`, `aud` containing `LD_ACCESS_AUD`, `exp` in the future, and a non-empty `email`. Returns the email or null; never throws.
- **Caching.** Discovery and JWKS live in instance fields on `Directory` with an expiry; eviction resets them, which is fine.
- **Tests.** msw handlers for discovery, token, provider JWKS and the Access certs URL. The test generates an RSA key with `crypto.subtle.generateKey` once per file, exports the public JWK for the JWKS handlers, and signs ID tokens and Access tokens with it; the token handler validates `code_verifier` against the challenge captured from the redirect. `openid-client` reaches those URLs through `fetch`, which msw intercepts.

### Module shapes & seams

#### [NEW] OIDC (`src/auth/oidc.ts`)
```ts
export function oidcEnabled(env: Env): boolean;
export function startLogin(c: Context): Promise<Response>;      // redirect + cookie
export function finishLogin(c: Context): Promise<string | null>; // username or null on any failure
```
Dependencies: `openid-client`, outbound `fetch` (mocked). Test strategy: HTTP seam.

#### [NEW] Access (`src/auth/access.ts`)
```ts
export function verifyAccessJwt(token: string, teamDomain: string, aud: string, fetchImpl?: typeof fetch): Promise<string | null>;
```
Invariant: returns null for any malformed or unverifiable token. Test strategy: HTTP seam.

#### [NEW] Identity login (`src/auth/identity.ts`)
```ts
export function loginIdentity(sql: SqlStorage, env: Env, username: string, now: string): Promise<string>;  // cookie value
```

## Sequence
1. `loginIdentity`, identity users, password 401 scenario.
2. OIDC start: routes, cookie, disabled scenarios.
3. OIDC callback scenarios with the test key.
4. Disabled login form.
5. Access middleware and scenarios.
6. Capability doc.
