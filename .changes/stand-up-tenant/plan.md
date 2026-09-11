# Stand up the Tenant Plan

## Approach
Greenfield. One Worker forwards every request to the Tenant Durable Object named `main`; a Hono app created once per object handles routing, forms and HTML. Migrations run synchronously in the object constructor. There is no client-side JavaScript in this slice. Tests run inside workerd through the Cloudflare Vitest plugin and reach the app the way a browser does, through the Worker's `fetch`.

This plan also fixes the project-wide layout and conventions that every later slice extends. Later plans reference this file for them.

```
wrangler.jsonc  package.json  tsconfig.json  vitest.config.ts  worker-configuration.d.ts
public/static/style.css        served at /static/style.css
src/index.ts                   Worker fetch, tenantFor(), export { Tenant }
src/tenant.ts                  Tenant Durable Object
src/app.ts                     createApp({ sql }) returning the Hono app
src/db/schema.ts               migrations[] and runMigrations(sql)
src/db/users.ts                user queries
src/db/sessions.ts             session and login attempt queries
src/auth/password.ts           hashPassword, verifyPassword
src/auth/session.ts            requireSession middleware, startSession, endSession
src/ui/auth.tsx                /setup, /login, /logout, /
src/ui/settings.tsx            /settings, /settings/password
src/views/layout.tsx           Layout and small form components
test/setup.ts                  reset() and msw wiring, runs before every test file
test/network.ts                setupNetwork() from @msw/cloudflare
test/helpers.ts                setupTenant(), login(), formPost(), cookieOf()
test/stand-up-tenant.test.ts
```

Later slices add `src/api/`, `src/search.ts`, `src/services/`, `src/datastar.ts`, more `src/db/*.ts`, `src/ui/*.tsx`, `src/views/*.tsx` and one test file per slice named after the slice.

## Implementation decisions

- **Runtime and tooling.** workerd in production and under `wrangler dev`. Node LTS and npm only for tooling. wrangler 4.131 or later bundles with esbuild and honours `jsx: "react-jsx"` and `jsxImportSource: "hono/jsx"` from `tsconfig.json`; no Vite, no separate build step. Types come from `wrangler types`, which writes `worker-configuration.d.ts` with the `Cloudflare.Env` namespace the test plugin expects; that file is committed and regenerated whenever `wrangler.jsonc` changes. Do not add `@cloudflare/workers-types`.
- **Dependencies.** Runtime: `hono` 4.x only. Dev: `wrangler`, `typescript`, `vitest` 4.1.x, `@cloudflare/vitest-plugin` 1.1.x, `msw` 2.x, `@msw/cloudflare`. Nothing else in this slice.
- **`wrangler.jsonc`.** `name: "lnkr"`, `main: "src/index.ts"`, `compatibility_date: "2026-08-01"`, `assets: { directory: "public", binding: "ASSETS" }`, `durable_objects.bindings: [{ name: "TENANT", class_name: "Tenant" }]`, `migrations: [{ tag: "v1", new_sqlite_classes: ["Tenant"] }]`, `vars: { LD_SESSION_COOKIE_AGE: "1209600" }`. `run_worker_first` stays unset: in production the platform serves `public/` before the Worker runs; in tests the Worker forwards `/static/*` to the `ASSETS` binding so assets are reachable through the same entry point.
- **Worker.** `src/index.ts` exports `{ Tenant }` and a default handler. `tenantFor(request, env)` is the only place that decides which object serves a request and returns `env.TENANT.idFromName("main")`, per `docs/adr/0001-one-object-per-tenant.md`. The handler forwards the request unchanged: `env.TENANT.get(tenantFor(request, env)).fetch(request)`.
- **Tenant object.** `class Tenant extends DurableObject<Env>`; the constructor runs `ctx.storage.transactionSync(() => runMigrations(ctx.storage.sql))` and then `this.app = createApp({ sql: ctx.storage.sql })`. `fetch(request)` returns `this.app.fetch(request, this.env)` so handlers read bindings from `c.env`. Never call `ctx.waitUntil`; it is a no-op in Durable Objects. No alarm in this slice.
- **Migrations.** `src/db/schema.ts` exports `migrations: string[]` and `runMigrations(sql)`. The runner creates `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)` if missing, reads applied versions, and executes each pending entry in order, inserting its row after it. Migration version equals array index plus one. `PRAGMA user_version` is not permitted in Durable Object SQLite, hence the table. Version 1:
  ```sql
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    prefs TEXT NOT NULL DEFAULT '{}',
    date_joined TEXT NOT NULL,
    last_login TEXT
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE login_attempts (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    failures INTEGER NOT NULL,
    window_start TEXT NOT NULL
  );
  ```
  `prefs` is a JSON document reserved for later slices. No `user_id` column ever appears on data tables (ADR 0001).
- **SQL access.** `ctx.storage.sql.exec(query, ...bindings)` with positional `?` parameters only; never interpolate values. Typed rows through `exec<Row>()`, consumed with `.toArray()` or `.one()` before any `await`. Every query lives in a function under `src/db/` that takes `sql: SqlStorage` as its first argument. No ORM, no query builder. Multi-statement strings are allowed only in migrations.
- **Timestamps.** ISO 8601 UTC with milliseconds from `new Date().toISOString()`; comparisons are string comparisons. The clock is `Date.now()` everywhere so tests can move it with `vi.setSystemTime`.
- **Passwords.** PBKDF2-SHA256 through `crypto.subtle.deriveBits`, exactly 100,000 iterations, a 16-byte random salt, a 32-byte key. Stored as `pbkdf2_sha256$100000$<salt base64>$<key base64>`. Verification derives with the stored salt and compares with `crypto.subtle.timingSafeEqual`. workerd in production refuses iteration counts above 100,000 while local workerd does not, so the constant must never be raised.
- **Sessions.** Id: 32 random bytes from `crypto.getRandomValues`, base64url. `expires_at` is now plus `LD_SESSION_COOKIE_AGE` seconds (string var, default `1209600`). Cookie `sessionid` with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` equal to the lifetime, and `Secure` exactly when `new URL(request.url).protocol === "https:"`. Lookup joins `users`; a row whose `expires_at` is past is deleted on sight and treated as absent. Logout deletes the row and answers with the same cookie at `Max-Age=0`. Cookies are read and written with `hono/cookie`.
- **Login limiter.** Per username, in `login_attempts`. Before verifying a password: if the row has `failures >= 5` and `window_start` within the last fifteen minutes, answer 429 without verifying. On failure: if the row is missing or `window_start` is older than fifteen minutes, write `failures = 1, window_start = now`; otherwise increment. On success delete the row. Thresholds are constants in `src/db/sessions.ts`.
- **Auth middleware.** `requireSession` runs on every route except `/setup`, `/login`, `/health` and `/static/*`. Without a valid session it answers 302 to `/login?next=` plus the encoded path and query. With one it sets `c.set("user", user)`. The `next` value is used after login only when it starts with `/` and not with `//`; otherwise `/`.
- **Setup.** GET and POST `/setup` exist only while `users` is empty; afterwards both answer 302 `/login`. POST trims the username, requires both fields non-empty, creates the user, starts a session and answers 302 `/`. A second user can never be created through the UI in this version.
- **Root.** `/` answers 302 `/settings` with a session and 302 `/login` without. browse-bookmarks-ui later changes the target to `/bookmarks`.
- **Change password.** POST `/settings/password` with `current`, `password`, `confirm`; verify current, require `password === confirm` and non-empty; store the new hash; 302 `/settings`. Validation failures answer 400 with the settings page and a message; nothing else about sessions changes.
- **CSRF.** `hono/csrf` applied to the whole app; it refuses form posts whose `Origin` does not match the request host. Test helpers send `Origin` equal to the app origin on every form POST.
- **Health.** `/health` answers `{"version": <package.json version>, "status": "healthy"}` after `SELECT 1` succeeds, otherwise 500 with `status: "unhealthy"`. The version is imported from `package.json` with a JSON import.
- **Views.** Hono JSX only. `Layout({ title, user, children })` renders the document with `<link rel="stylesheet" href="/static/style.css">` and a nav showing Settings and a Logout form when a user is present. Responses go through `c.html(...)`. Every string is escaped by JSX; never use `dangerouslySetInnerHTML` in this slice.
- **Errors.** Unknown routes answer 404 through Hono's default. Nothing is logged in this slice.

### Module shapes & seams

#### [NEW] Worker entry (`src/index.ts`)
```ts
export { Tenant } from "./tenant";
export function tenantFor(request: Request, env: Env): DurableObjectId;
export default { fetch(request: Request, env: Env): Promise<Response> } satisfies ExportedHandler<Env>;
```
Dependencies: the `TENANT` namespace and the `ASSETS` fetcher from `Env`. Invariant: the request object reaches the Tenant untouched. Test strategy: covered only through the HTTP seam by every other scenario.

#### [NEW] Tenant (`src/tenant.ts`)
```ts
export class Tenant extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env);
  fetch(request: Request): Promise<Response>;
}
```
Invariant: by the time `fetch` runs, every migration has been applied. Test strategy: HTTP seam; one storage-seam test calls `runMigrations(state.storage.sql)` again inside `runInDurableObject` and reads `schema_migrations`.

#### [NEW] createApp (`src/app.ts`)
```ts
export type AppDeps = { sql: SqlStorage };
export type AppEnv = { Bindings: Env; Variables: { user: User } };
export function createApp(deps: AppDeps): Hono<AppEnv>;
```
Wires csrf, `requireSession`, and the UI routers. Test strategy: HTTP seam.

#### [NEW] Password (`src/auth/password.ts`)
```ts
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored: string): Promise<boolean>;
```
Invariant: a stored hash never verifies a different password; verification is constant-time on the key comparison. Test strategy: HTTP seam through login and change password; no direct unit test.

#### [NEW] Session (`src/auth/session.ts`, `src/db/sessions.ts`)
```ts
export const requireSession: MiddlewareHandler<AppEnv>;
export function startSession(c: Context<AppEnv>, userId: number): Promise<void>;  // writes row and cookie
export function endSession(c: Context<AppEnv>): Promise<void>;
// src/db/sessions.ts
export function createSession(sql, userId: number, expiresAt: string): string;
export function findSessionUser(sql, id: string, now: string): User | null;
export function deleteSession(sql, id: string): void;
export function isLoginLocked(sql, username: string, now: string): boolean;
export function recordLoginFailure(sql, username: string, now: string): void;
export function clearLoginFailures(sql, username: string): void;
```
Test strategy: HTTP seam with `vi.setSystemTime` for expiry and the limiter window.

#### [NEW] Users (`src/db/users.ts`)
```ts
export type User = { id: number; username: string; passwordHash: string; prefs: string; dateJoined: string; lastLogin: string | null };
export function countUsers(sql): number;
export function createUser(sql, username: string, passwordHash: string, now: string): User;
export function findUserByUsername(sql, username: string): User | null;
export function updatePassword(sql, id: number, passwordHash: string): void;
```

#### [NEW] Test harness (`test/setup.ts`, `test/network.ts`, `test/helpers.ts`)
- `vitest.config.ts`: `cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })` and `test.setupFiles: ["test/setup.ts"]`.
- `test/network.ts`: `export const network = setupNetwork()`.
- `test/setup.ts`: `beforeAll(() => network.enable())`; `beforeEach` awaits `reset()` from `cloudflare:test` and registers `network.use(http.all("*", () => HttpResponse.error()))` so any outbound request a test did not mock fails; `afterEach(() => network.resetHandlers())`; `afterAll(() => network.disable())`. Per-test handlers registered with `network.use` after the catch-all take precedence.
- Requests go through `exports.default.fetch(url, init)` from `cloudflare:workers` with the base URL `https://lnkr.test`; `SELF` and `env` from `cloudflare:test` are deprecated and must not be used. `runInDurableObject` and `reset` come from `cloudflare:test`; `env` comes from `cloudflare:workers`.
- Helpers: `setupTenant(username, password)` posts `/setup` and returns the session cookie; `login(username, password)` returns the response; `formPost(path, fields, { cookie, origin })` sends `application/x-www-form-urlencoded` with `Origin: https://lnkr.test` by default; `cookieOf(response)` extracts the `sessionid` value. Time-dependent scenarios use `vi.useFakeTimers()` and `vi.setSystemTime()` and restore real timers afterwards.

## Sequence
1. Scaffold: `package.json` scripts (`dev`, `test`, `deploy`, `typecheck`, `types`), `tsconfig.json`, `wrangler.jsonc`, `wrangler types`, `vitest.config.ts`, `test/setup.ts`, `test/network.ts`, `public/static/style.css`. `npm test` runs an empty suite green.
2. Tenant, migrations, `createApp`, `/health`: the first request travels Worker to object to Hono to SQLite. Health scenario and the migration scenario.
3. Password hashing and `/setup` with its scenarios.
4. Sessions, `/login`, `/logout`, `requireSession`, root redirect, `next` handling, cookie attributes and expiry scenarios.
5. Login limiter scenarios.
6. `/settings` page and change password scenarios.
7. CSRF scenario.
8. Capability doc.
