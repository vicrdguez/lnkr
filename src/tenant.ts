import { DurableObject } from "cloudflare:workers";
import { createApp } from "./app";
import { createUserSession } from "./auth/session";
import { runMigrations } from "./db/schema";
import { countUsers, createUser, firstUser } from "./db/users";

/** One Tenant's data and HTTP handling; every migration is applied before `fetch` runs. */
export class Tenant extends DurableObject<Env> {
  private readonly app: ReturnType<typeof createApp>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.transactionSync(() => runMigrations(ctx.storage.sql));
    this.app = createApp({
      sql: ctx.storage.sql,
      transaction: (closure) => ctx.storage.transactionSync(closure),
      // Every Tenant is reached through idFromName, so the name is its tenant key.
      tenantKey: ctx.id.name ?? "main",
    });
  }

  async fetch(request: Request): Promise<Response> {
    // DEBT(#36/W1): a bare stale sessionid cookie or token (linkding's cookie name, same host) on a fresh Instance routes to the unprovisioned main and gets this 404 on every path, /setup and /login included, until the browser drops it.
    // A Tenant nobody provisioned, such as one named by a forged prefix, has nothing to serve.
    if (!countUsers(this.ctx.storage.sql)) return new Response("Not Found", { status: 404 });
    return this.app.fetch(request, this.env);
  }

  /** The Tenant's single user's name, or null while unprovisioned. */
  describe(): { username: string | null } {
    return { username: firstUser(this.ctx.storage.sql)?.username ?? null };
  }

  /** Creates the Tenant's user; the only way a Tenant gains one. */
  provision(username: string, passwordHash: string): void {
    const sql = this.ctx.storage.sql;
    if (countUsers(sql)) throw new Error("Tenant already provisioned");
    createUser(sql, username, passwordHash, new Date().toISOString());
  }

  /** Starts a session for the Tenant's user and returns its bare id. */
  startSession(): string {
    const user = firstUser(this.ctx.storage.sql);
    if (!user) throw new Error("Tenant not provisioned");
    return createUserSession(this.ctx.storage.sql, this.env, user.id);
  }
}
