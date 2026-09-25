import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { health } from "./app";
import { formatCredential, newTenantKey } from "./auth/credential";
import { hashPassword } from "./auth/password";
import { setSessionCookie } from "./auth/session";
import { MISSING_CREDENTIALS } from "./auth/token";
import { countUsers, deleteUser, findUser, insertUser, runDirectoryMigrations } from "./db/directory";
import { formFields } from "./ui/form";
import { INVALID_CREDENTIALS, LoginForm, SetupForm } from "./views/auth";

/** Usernames, their tenant keys and Instance settings; serves every request that carries no credential. */
export class Directory extends DurableObject<Env> {
  private readonly app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.transactionSync(() => runDirectoryMigrations(ctx.storage.sql));
    this.app = createDirectoryApp({ sql: ctx.storage.sql, env });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureRegistered();
    return this.app.fetch(request, this.env);
  }

  /** The tenant key owning `username`, or null when nobody has that name. */
  async lookup(username: string): Promise<string | null> {
    await this.ensureRegistered();
    return findUser(this.ctx.storage.sql, username)?.tenantKey ?? null;
  }

  /** Registers the user of a `main` Tenant set up before the Directory existed, once, as superuser. */
  private async ensureRegistered(): Promise<void> {
    const sql = this.ctx.storage.sql;
    if (countUsers(sql)) return;
    const { username } = await this.env.TENANT.get(this.env.TENANT.idFromName("main")).describe();
    if (username) insertUser(sql, username, "main", true, new Date().toISOString());
  }
}

/** The pages a visitor without a credential can reach: login, first-run setup and health. */
export function createDirectoryApp({ sql, env }: { sql: SqlStorage; env: Env }): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  // Without a token an API client gets linkding's 401 and a feed 404, as the Tenant answers them, not a login page.
  app.all("/api/*", (c) => c.json(MISSING_CREDENTIALS, 401));
  app.all("/feeds/*", (c) => c.notFound());
  app.use(csrf());

  app.get("/health", (c) => health(c, sql));
  app.get("/", (c) => c.redirect("/login"));
  app.get("/login", (c) => c.html(<LoginForm />));
  // The Worker sends a login here only when no Tenant owns the username.
  // ponytail: unknown usernames are not rate limited; add a Directory-side counter if abuse shows.
  app.post("/login", (c) => c.html(<LoginForm error={INVALID_CREDENTIALS} />, 401));

  app.get("/setup", (c) => (countUsers(sql) ? c.redirect("/login") : c.html(<SetupForm />)));
  app.post("/setup", async (c) => {
    if (countUsers(sql)) return c.redirect("/login");
    const { username, password } = await formFields(c, "username", "password");
    const name = username.trim();
    if (!name || !password) return c.html(<SetupForm error="Username and password are required." />, 400);
    const passwordHash = await hashPassword(password);
    // Hashing yielded; another request may have completed setup meanwhile.
    if (countUsers(sql)) return c.redirect("/login");
    const key = newTenantKey();
    const user = insertUser(sql, name, key, true, new Date().toISOString());
    if (!user) return c.redirect("/login");
    const tenant = env.TENANT.get(env.TENANT.idFromName(key));
    let sessionId: string;
    try {
      await tenant.provision(name, passwordHash);
      sessionId = await tenant.startSession();
    } catch {
      deleteUser(sql, user.id);
      return c.text("Setup failed", 500);
    }
    setSessionCookie(c, formatCredential(key, sessionId));
    return c.redirect("/");
  });

  app.all("*", (c) => {
    const { pathname, search } = new URL(c.req.url);
    return c.redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  });
  return app;
}
