# Add the Directory

## Why
An Instance holds exactly one Tenant today, hard-wired to the object named `main`. Adding a second person means the Worker must find the right Tenant for a request, and something must remember which usernames exist. ADR 0001 places each Tenant in its own object and reserves a small directory object for lookup, superuser flags and Instance-wide settings; this slice builds that directory and the routing around it while keeping the existing Tenant working unchanged.

## What
A second Durable Object class, `Directory`, with one instance named `main`, holding the users table and the Instance settings. Tenant objects are named by a random tenant key. Session cookies and API tokens carry the tenant key as a prefix so the Worker routes ordinary requests without touching the Directory; a value without a prefix still maps to the legacy `main` Tenant. Login asks the Directory which Tenant owns a username and forwards the credentials there. Setup on a fresh Instance creates the first user in the Directory as superuser and provisions its Tenant. On its first request the Directory registers an already existing `main` Tenant under its username.

## Scope
- `Directory` Durable Object class, binding `DIRECTORY`, wrangler migration tag `v2`, own SQLite schema: `users`, `settings`
- Directory RPC used by the Worker: `lookup(username)` returning the tenant key or null
- Tenant RPC used by the Directory: `describe()`, `provision(username, passwordHash)`, `startSession()`
- `tenantFor(request, env)` parses the tenant key from the `Authorization: Token` header, a `/feeds/<token>/` path or the `sessionid` cookie; a value with no dot means `main`; no credential at all means the Directory
- Session cookie values become `<tenant key>.<session id>`; API tokens and feed tokens are displayed and accepted as `<tenant key>.<key>`; bare values keep working for `main`
- POST `/login` is routed by the submitted username through the Directory; an unknown username is answered by the Directory with the same 401 page
- Directory-served public routes: GET `/login`, GET and POST `/setup`, `/health`, `/`
- Setup on a fresh Instance creates the superuser in the Directory, a Tenant with a fresh key, and logs the user in; the Tenant's own `/setup` route is removed
- A Tenant that has never been provisioned answers 404 to every request
- One-time registration of a pre-existing `main` Tenant on the Directory's first request
- Login and setup views shared between the Tenant app and the Directory app

## Out of Scope
- Creating further users; that is administer-users
- OIDC and Cloudflare Access; that is login-with-external-identity
- Anything shared across Tenants; that is share-bookmarks
- The login attempt limiter for usernames that do not exist
- Moving data between Tenants or renaming a Tenant key

## Definition of Done
- [ ] On a fresh Instance, `/setup` creates a superuser in the Directory, provisions a Tenant with a random key, starts a session with a prefixed cookie and redirects to `/`; afterwards `/setup` redirects to `/login`.
- [ ] An Instance whose `main` Tenant was set up before this slice keeps working: its username is registered as superuser on the Directory's first request, its bare session cookies and bare API tokens still reach `main`, and login for that username works.
- [ ] POST `/login` for a known username reaches that user's Tenant, which applies its password check and limiter and sets a cookie prefixed with the tenant key.
- [ ] POST `/login` for an unknown username answers 401 with the login form and sets no cookie.
- [ ] Requests carrying a prefixed cookie, token or feed token are served by the Tenant named by the prefix without any Directory call.
- [ ] Requests with no credential are served by the Directory: GET `/login`, `/setup`, `/health` and `/` work, and any other path redirects to `/login`.
- [ ] A forged prefix pointing at a Tenant that was never provisioned answers 404 on every path.
- [ ] Two users on one Instance never see each other's bookmarks.
- [ ] The settings page shows the API token with the tenant key prefix and the extension works with it.

## Manual verification
- [ ] Deploy over an existing Instance; the existing browser session and the extension token keep working without re-login.
