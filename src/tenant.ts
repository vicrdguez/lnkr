import { DurableObject } from "cloudflare:workers";
import { createApp } from "./app";
import { runMigrations } from "./db/schema";

/** One Tenant's data and HTTP handling; every migration is applied before `fetch` runs. */
export class Tenant extends DurableObject<Env> {
  private readonly app: ReturnType<typeof createApp>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.transactionSync(() => runMigrations(ctx.storage.sql));
    this.app = createApp({ sql: ctx.storage.sql });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }
}
