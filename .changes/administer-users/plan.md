# Administer users Plan

## Approach
The Directory stays the authority for who exists and who is a superuser; the Tenant app renders the page and forwards each action as one Directory RPC, which in turn calls the target Tenant's RPC where the target's own storage changes. The only new state on a Tenant is the mirrored flag. Project conventions come from `.changes/stand-up-tenant/plan.md`; the Directory, credentials and RPC shapes from `.changes/add-directory/plan.md`.

New and changed files:
```
src/directory.ts             RPC methods, ensureRegistered marks main as superuser on the Tenant
src/db/directory.ts          user and settings queries
src/tenant.ts                setPassword, setSuperuser, wipe
src/db/schema.ts             Tenant migration 6: users.is_superuser
src/ui/admin.tsx             /admin routes
src/views/admin.tsx          AdminPage
src/views/layout.tsx         Admin nav link
test/administer-users.test.ts
```

## Implementation decisions

- **Tenant migration 6** (renumber if lower ones have not merged): `ALTER TABLE users ADD COLUMN is_superuser INTEGER NOT NULL DEFAULT 0`. The Directory writes it through `tenant.setSuperuser(flag)` whenever the flag changes, at provisioning, and during legacy registration of `main`, which calls `setSuperuser(true)` after inserting the row. Setup on a fresh Instance provisions with the flag true.
- **Authority.** `requireSuperuser` middleware on `/admin*`: after `requireSession`, it calls `directory.isSuperuser(tenantKey)` and answers 403 when false. The nav reads the mirror from the session's user row only; a stale mirror can show or hide a link, never grant access.
- **Directory RPC** (public methods on `Directory`, each running `ensureRegistered()` first):
  ```ts
  listUsers(): DirectoryUser[];                                   // id, username, tenantKey, isSuperuser, dateJoined
  createUser(username: string, passwordHash: string): DirectoryUser;  // inserts, provisions the Tenant, throws "exists" on a case-insensitive duplicate
  deleteUser(id: number): void;                                   // tenant.wipe() then delete the row; throws "unknown"
  setSuperuser(id: number, flag: boolean): void;                  // row then tenant.setSuperuser
  resetPassword(id: number, passwordHash: string): void;          // tenant.setPassword
  isSuperuser(tenantKey: string): boolean;
  getSettings(): { landingPage: "login" | "shared_bookmarks"; guestProfileUserId: number | null };
  updateSettings(patch): void;                                    // validates; unknown user id becomes null; unknown landing page becomes "login"
  ```
  Password hashing happens in the caller's Tenant with the existing `hashPassword`, so the Directory never sees a password.
- **Tenant RPC additions.** `setPassword(hash)` updates the single user's hash and deletes every session row; `setSuperuser(flag)` updates the mirror; `wipe()` runs `ctx.storage.deleteAll()` and then `ctx.abort()` so the next request constructs a fresh, unprovisioned object that answers 404 as add-directory specified. `deleteAll` also removes the schema, and the constructor re-applies migrations on the next construction.
- **Deletion order.** `deleteUser` wipes the Tenant first, then removes the Directory row, so a failure leaves a user whose Tenant is empty but recreatable by deleting again; never the reverse, which would orphan data.
- **Self-protection.** The acting user's Directory id is resolved by `tenantKey` at request time; `superuser` and `delete` on that id answer 400 with the admin page and a message.
- **Routes.** All in `src/ui/admin.tsx` under `requireSession` and `requireSuperuser`, forms through `hono/csrf`. `POST /admin/users`: trim username, require both fields non-empty, hash, `createUser`; a duplicate answers 400 with `A user with this name already exists.`. `POST /admin/users/:id/password`: require non-empty. `POST /admin/users/:id/superuser` toggles. `POST /admin/users/:id/delete`. `POST /admin/settings`. Success answers 302 `/admin`; unknown ids 404.
- **Page.** `AdminPage` renders the users table, the create form, per-row forms (Delete with `confirm()`), and the settings form with a `landing_page` select and a `guest_profile_user_id` select listing users plus an empty option.
- **Tests** at the HTTP seam with two or three provisioned users through `/setup` and the admin page; the legacy scenario provisions `main` inside `runInDurableObject` as add-directory's tests do.

### Module shapes & seams

#### [MODIFIED] Directory (`src/directory.ts`) and Tenant (`src/tenant.ts`)
RPC as listed. Invariants: a username exists at most once regardless of case; a Directory row always has a provisioned Tenant except transiently during `createUser`. Test strategy: HTTP seam through the admin page and login.

#### [NEW] Admin routes (`src/ui/admin.tsx`)
```ts
export const admin: Hono<AppEnv>;
export const requireSuperuser: MiddlewareHandler<AppEnv>;
```
Test strategy: HTTP seam.

## Sequence
1. Migration 6, mirror, `setSuperuser` at setup and registration, nav link, `requireSuperuser`, access scenarios.
2. `createUser` and the create scenarios.
3. Reset password and superuser toggle scenarios.
4. `wipe`, `deleteUser` and the delete scenarios.
5. Settings scenarios.
6. Capability doc.
