# Stand up the Tenant

## Why
lnkr has no code yet. Every later slice needs a deployable Worker, a Tenant Durable Object with a migrated SQLite database, a logged-in user and a test harness that runs inside workerd. This slice lays that path end to end so the first person can set up an Instance and log in.

## What
A Cloudflare Worker resolves every request to the single Tenant object named `main` and forwards it unchanged to a Hono app running inside the object. The object applies schema migrations when it is constructed. The app offers first-run setup, password login and logout with a session cookie, a login attempt limiter, change password on the settings page, a public health endpoint and static files from `public/`. Vitest runs the tests inside workerd through the Cloudflare Vitest plugin at the HTTP seam.

## Scope
- Project scaffold: `wrangler.jsonc`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `public/style.css`, `.dev.vars.example`
- Worker entry with one routing function that returns the `main` Tenant object for every request
- `Tenant` Durable Object class: synchronous migration runner on construction, `schema_migrations` table, Hono app created once per object
- Schema version 1: `users`, `sessions`, `login_attempts`
- `/setup`: GET shows the form and POST creates the Tenant's user, only while no user exists; afterwards both redirect to `/login`
- `/login`: GET form, POST verifies the password, starts a session, honours a same-origin `next` path
- Login attempt limiter: five failures for a username within fifteen minutes refuse further attempts until the window ends; success resets the count
- `/logout` POST ends the session and clears the cookie
- Session cookie `sessionid`: HttpOnly, SameSite=Lax, Path=/, Secure when the request is https, lifetime from `LD_SESSION_COOKIE_AGE` seconds with a default of fourteen days; expired sessions are rejected
- Auth middleware: every route except `/setup`, `/login`, `/health` and static files redirects to `/login?next=<path>` without a valid session
- `/` redirects to `/settings` when logged in, otherwise to `/login`
- `/settings` GET page shell with the change password form; `/settings/password` POST requires the current password and a matching confirmation
- `/health` GET returns JSON with status and the package version, without authentication
- CSRF protection on every form POST through `hono/csrf`
- Password hashing with PBKDF2-SHA256 at 100,000 iterations through Web Crypto
- Layout view with navigation and a stylesheet
- Test harness: Vitest with `@cloudflare/vitest-plugin`, tests at the HTTP seam through `SELF.fetch`, one storage-seam test for migrations, a shared helper that sets up and logs in

## Out of Scope
- Bookmarks, tags, search, the REST API and API tokens
- User preferences beyond the password
- More than one Tenant, the directory, admin pages
- OIDC, Cloudflare Access, password reset by email, remember-me
- Datastar and any client-side behaviour
- Rate limiting of anything except login

## Definition of Done
- [x] On a fresh Instance `/setup` shows a form; submitting a username and password creates the user, starts a session and redirects to `/`.
- [x] `/setup` rejects an empty username or password with the form re-rendered and creates nothing.
- [x] Once a user exists, GET and POST `/setup` redirect to `/login` and create nothing.
- [x] A protected page without a valid session redirects to `/login?next=<path>`.
- [x] Correct credentials set a `sessionid` cookie with HttpOnly, SameSite=Lax, Path=/ and a fourteen-day Max-Age, with Secure only over https, and redirect to `next` when it is a same-origin path, otherwise to `/`.
- [x] Wrong credentials, or an unknown username, answer 401 with the login form, an error message and no cookie.
- [x] After five failed attempts for a username within fifteen minutes, the next attempt answers 429 even with the right password; once the window has passed, or after a successful login, attempts are accepted again.
- [x] `/logout` deletes the session and clears the cookie; the old cookie no longer grants access.
- [x] A session older than its lifetime is rejected and the request redirects to `/login`.
- [x] Change password succeeds only with the correct current password and a matching confirmation; afterwards the new password logs in and the old one does not.
- [x] A form POST whose `Origin` is another site is refused with 403.
- [x] `/health` answers 200 JSON with `status` and `version` without a session.
- [x] Applying migrations to an object that already has them changes nothing and `schema_migrations` holds one row per migration.
- [x] `npm test` runs inside workerd and is green.

## Manual verification
- [ ] `wrangler dev` serves `/setup`, the stylesheet from `public/` and the login flow in a browser.
- [ ] `wrangler deploy` to a Free-plan account, first request made from the region you use; `/setup` and login work over https with the Secure cookie and the first request after idle takes well under a second.
