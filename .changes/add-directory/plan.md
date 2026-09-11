# Add the Directory Plan

## Approach
Introduce a second Durable Object, `Directory`, that owns usernames, tenant keys, the superuser flag and Instance settings, and make the Worker route by a tenant key carried inside every credential. The Tenant app stays as it is, minus `/setup`, and gains three RPC methods the Directory calls. The Directory runs its own small Hono app for the routes a visitor can reach without a credential. Legacy compatibility is a single rule: a credential without a dot belongs to `main`.

Extends the layout in `.changes/stand-up-tenant/plan.md`:
```
src/directory.ts               Directory Durable Object and its Hono app
src/db/directory.ts            Directory migrations and queries
src/views/auth.tsx             LoginForm and SetupForm, shared by both apps
src/auth/credential.ts         parseTenantKey(value), formatCredential(key, value)
test/add-directory.test.ts
```

## Implementation decisions

- **Wrangler.** Add `{ name: "DIRECTORY", class_name: "Directory" }` to `durable_objects.bindings` and `{ tag: "v2", new_sqlite_classes: ["Directory"] }` to `migrations`. `worker-configuration.d.ts` regenerated.
- **Tenant key.** 16 random bytes as 32 lowercase hex characters from `crypto.getRandomValues`, or the literal `main` for the legacy Tenant. `isTenantKey(s)` accepts exactly those two shapes. Tenant objects are `env.TENANT.idFromName(key)`; the Directory is `env.DIRECTORY.idFromName("main")`.
- **Credential format.** Cookie `sessionid`, `Authorization: Token`, and feed token path segment all carry `<key>.<value>`. `parseTenantKey(value)`: if the value contains a dot, the part before the first dot must satisfy `isTenantKey`, otherwise the credential is ignored; a value with no dot returns `main`. The Tenant reads its own key from `this.ctx.id.name` and writes it into every credential it issues. Session and token lookups strip the prefix before querying. Bare values in storage stay as they are; nothing is rewritten.
- **`tenantFor(request, env)`** now returns `DurableObjectId | null`, checked in this order: `Authorization: Token <v>` header, path matching `^/feeds/([^/]+)/`, `sessionid` cookie. Null means the Directory serves the request. POST `/login` is the one exception: the Worker clones the request, reads `username` from the form body, calls `directory.lookup(username)` and forwards the original request to that Tenant, or to the Directory when the lookup returns null. `/setup` is always served by the Directory.
- **Directory schema** (`src/db/directory.ts`, same runner shape as the Tenant's, own `schema_migrations`):
  ```sql
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tenant_key TEXT NOT NULL UNIQUE,
    is_superuser INTEGER NOT NULL DEFAULT 0,
    date_joined TEXT NOT NULL
  );
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    landing_page TEXT NOT NULL DEFAULT 'login',
    guest_profile_user_id INTEGER
  );
  INSERT INTO settings (id) VALUES (1);
  ```
- **Legacy registration.** `Directory.ensureRegistered()` runs at the start of every Directory request and RPC: if `users` is empty, call `env.TENANT.get(idFromName("main")).describe()`; when it returns a username, insert it with tenant key `main` and `is_superuser` 1. Idempotent through `INSERT OR IGNORE`. The `main` Tenant keeps working without any data change.
- **Tenant RPC** (public methods on `Tenant`, callable through the stub):
  - `describe(): { username: string | null }`, the single user's name or null when unprovisioned.
  - `provision(username, passwordHash): void`, creates the users row; throws if a user already exists.
  - `startSession(): string`, creates a session row and returns its bare id.
  - A Tenant whose `users` table is empty answers 404 to every HTTP request before routing.
  - The Tenant `/setup` routes are deleted.
- **Directory app** (`createDirectoryApp({ sql, env })`): `hono/csrf`; GET `/login` renders `LoginForm`; POST `/login` answers 401 with `LoginForm` and the invalid-credentials message, without a limiter (`ponytail:` unknown usernames are not rate limited; add a Directory-side counter if abuse shows); GET and POST `/setup` while `users` is empty, otherwise 302 `/login`; `/health` as the Tenant's; `/` answers 302 `/login`; every other path answers 302 `/login?next=<path>`.
- **Setup flow.** POST `/setup`: validate as before, generate a key, `hashPassword`, insert the Directory user with `is_superuser` 1, call `tenant.provision(username, hash)` then `tenant.startSession()`, set `sessionid` to `<key>.<id>` with the same cookie attributes as the Tenant, 302 `/`. If `provision` throws, delete the Directory row and answer 500.
- **Views.** Move the login and setup form markup from `src/ui/auth.tsx` into `src/views/auth.tsx` so both apps render identical pages.
- **Feed tokens and API tokens** are displayed with the prefix on the settings page; the token regenerate, feed URLs and any place that prints a credential go through `formatCredential`.
- **No Directory call on ordinary requests.** The only Directory RPC from the Worker is `lookup` on POST `/login`. The Tenant never calls the Directory in this slice.

### Module shapes & seams

#### [NEW] Directory (`src/directory.ts`)
```ts
export class Directory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env);           // runs Directory migrations
  fetch(request: Request): Promise<Response>;               // ensureRegistered, then the app
  lookup(username: string): Promise<string | null>;         // tenant key
}
export function createDirectoryApp(deps: { sql: SqlStorage; env: Env }): Hono;
```
Invariant: a username maps to exactly one tenant key and the map never changes in this slice. Test strategy: HTTP seam; one storage-seam test for migrations; the registration scenario reads `users` inside `runInDurableObject`.

#### [MODIFIED] Tenant (`src/tenant.ts`)
```ts
describe(): { username: string | null };
provision(username: string, passwordHash: string): void;
startSession(): string;
```
Invariant: `provision` is the only way a Tenant gains a user. Test strategy: HTTP seam through setup and login; `provision` is called inside `runInDurableObject` to seed the legacy scenarios.

#### [MODIFIED] Worker (`src/index.ts`)
```ts
export function tenantFor(request: Request, env: Env): DurableObjectId | null;
```
Test strategy: HTTP seam through every routing scenario.

#### [NEW] Credential helpers (`src/auth/credential.ts`)
```ts
export function isTenantKey(s: string): boolean;
export function parseTenantKey(value: string): string | null;   // null = ignore credential
export function formatCredential(key: string, value: string): string;
```

#### [NEW] Directory queries (`src/db/directory.ts`)
```ts
export const directoryMigrations: string[];
export function runDirectoryMigrations(sql: SqlStorage): void;
export function countUsers(sql): number;
export function insertUser(sql, username: string, tenantKey: string, isSuperuser: boolean, now: string): DirectoryUser;
export function findUser(sql, username: string): DirectoryUser | null;
```

## Sequence
1. Credential helpers and the `tenantFor` rewrite; existing tests still green with bare credentials mapping to `main`.
2. Tenant RPC methods, `/setup` removal, unprovisioned 404.
3. Directory class, migrations, app with `/login`, `/setup`, `/health`, `/`; wrangler binding.
4. Worker POST `/login` routing through `lookup`.
5. Legacy registration and its scenarios.
6. Isolation scenarios with a second provisioned Tenant.
7. Capability doc.
