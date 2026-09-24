import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { newTenantKey } from "../src/auth/credential";
import { hashPassword } from "../src/auth/password";
import { directoryMigrations, insertUser, runDirectoryMigrations } from "../src/db/directory";
import {
  api,
  apiToken,
  cookieOf,
  formPost,
  get,
  location,
  login,
  PASSWORD,
  provisionLegacyMain,
  select,
  setCookieOf,
  setupInstance,
  tenantKeyOf,
  USERNAME,
} from "./helpers";

const directory = () => env.DIRECTORY.get(env.DIRECTORY.idFromName("main"));
const tenant = (key: string) => env.TENANT.get(env.TENANT.idFromName(key));

/** Registers `username` in the Directory under a fresh tenant key and provisions that Tenant, as administration will. */
async function registerUser(username: string, password: string): Promise<string> {
  const key = newTenantKey();
  await runInDurableObject(directory(), (_directory, state) => {
    insertUser(state.storage.sql, username, key, false, new Date().toISOString());
  });
  const passwordHash = await hashPassword(password);
  await runInDurableObject(tenant(key), (instance) => instance.provision(username, passwordHash));
  return key;
}

/** A redirect's target as path plus query. */
const target = (response: Response) => {
  const url = location(response);
  return url.pathname + url.search;
};

describe("Setup on a fresh Instance", () => {
  it("creates the superuser and a Tenant", async () => {
    const response = await formPost("/setup", { username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/");
    const cookie = cookieOf(response) ?? "";
    expect(cookie).toMatch(/^[0-9a-f]{32}\.[^.]+$/);
    const key = tenantKeyOf(cookie);
    const settings = await get("/settings", { cookie });
    expect(settings.status).toBe(200);
    const [feed] = await select(await settings.text(), "#feed-all");
    expect(feed.attrs.href).toContain(`/feeds/${key}.`);
    // Existing token keys are never listed again, so the API token is observed as the page shows it on creation.
    expect(await apiToken(cookie)).toMatch(new RegExp(`^${key}\\.[0-9a-f]{40}$`));
    const users = await runInDurableObject(directory(), (_directory, state) =>
      state.storage.sql.exec("SELECT username, tenant_key, is_superuser FROM users").toArray(),
    );
    expect(users).toEqual([{ username: USERNAME, tenant_key: key, is_superuser: 1 }]);
  });

  it("closes after the first user", async () => {
    await setupInstance();

    const response = await get("/setup");

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/login");
  });

  it("is no longer offered by the Tenant", async () => {
    const cookie = await setupInstance();

    const response = await get("/setup", { cookie });

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/login");
  });
});

describe("Registering a pre-existing main Tenant", () => {
  beforeEach(async () => {
    await provisionLegacyMain();
  });

  it("registers main on the first Directory request", async () => {
    const response = await get("/login");

    expect(response.status).toBe(200);
    const users = await runInDurableObject(directory(), (_directory, state) =>
      state.storage.sql.exec("SELECT username, tenant_key, is_superuser FROM users").toArray(),
    );
    expect(users).toEqual([{ username: USERNAME, tenant_key: "main", is_superuser: 1 }]);
  });

  it("logs the registered user in to main", async () => {
    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/");
    const cookie = cookieOf(response) ?? "";
    expect(cookie.startsWith("main.")).toBe(true);
    expect((await get("/settings", { cookie })).status).toBe(200);
  });

  it("still accepts a bare session cookie", async () => {
    const session = await runInDurableObject(tenant("main"), (instance) => instance.startSession());

    expect((await get("/settings", { cookie: session })).status).toBe(200);
  });

  it("still accepts a bare API token", async () => {
    const key = "a".repeat(40);
    await runInDurableObject(tenant("main"), (_tenant, state) => {
      state.storage.sql.exec("INSERT INTO api_tokens (key, created) VALUES (?, ?)", key, new Date().toISOString());
    });

    expect((await api(key).get("/api/user/profile/")).status).toBe(200);
  });

  it("closes setup", async () => {
    const response = await get("/setup");

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/login");
  });
});

describe("Login routing", () => {
  let key: string;

  beforeEach(async () => {
    key = tenantKeyOf(await setupInstance());
  });

  it("sends a known username to its Tenant", async () => {
    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/");
    expect(cookieOf(response)?.startsWith(`${key}.`)).toBe(true);
  });

  it.each([
    ["a wrong password, refused by the Tenant", USERNAME, "wrong"],
    ["an unknown username, refused by the Directory", "nobody", "whatever"],
  ])("answers 401 for %s", async (_case, username, password) => {
    const response = await login(username, password);

    expect(response.status).toBe(401);
    const errors = await select(await response.text(), ".error");
    expect(errors.map((error) => error.text)).toEqual(["Invalid username or password"]);
    expect(setCookieOf(response)).toBeUndefined();
  });

  it("keeps the Tenant's limiter", async () => {
    for (let i = 0; i < 5; i++) expect((await login(USERNAME, "wrong")).status).toBe(401);

    expect((await login(USERNAME, PASSWORD)).status).toBe(429);
  });

  it("honours a same-origin next path", async () => {
    const response = await formPost("/login?next=/settings", { username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/settings");
  });
});

describe("Routing by credential prefix", () => {
  let cookie: string;

  beforeEach(async () => {
    cookie = await setupInstance();
  });

  it("serves a prefixed cookie from its Tenant", async () => {
    expect((await get("/settings", { cookie })).status).toBe(200);
  });

  it("serves a prefixed API token from its Tenant", async () => {
    const token = await apiToken(cookie);

    expect((await api(token).get("/api/user/profile/")).status).toBe(200);
  });

  it("serves a prefixed feed token from its Tenant", async () => {
    const [feed] = await select(await (await get("/settings", { cookie })).text(), "#feed-all");

    const response = await get(new URL(feed.attrs.href).pathname);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(await response.text()).toContain("<rss");
  });

  it("sends a request without a credential to login through the Directory", async () => {
    const response = await get("/bookmarks");

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/login?next=%2Fbookmarks");
    expect(location(response).searchParams.get("next")).toBe("/bookmarks");
  });

  it("serves health without a credential", async () => {
    const response = await get("/health");

    expect(response.status).toBe(200);
    expect((await response.json<{ status: string }>()).status).toBe("healthy");
  });

  it("sends the root without a credential to login", async () => {
    const response = await get("/");

    expect(response.status).toBe(302);
    expect(target(response)).toBe("/login");
  });

  it.each(["/settings", "/bookmarks", "/setup"])("answers 404 at %s for a forged prefix", async (path) => {
    expect((await get(path, { cookie: "0123456789abcdef0123456789abcdef.x" })).status).toBe(404);
  });

  it("treats a malformed prefix as no credential", async () => {
    const response = await get("/settings", { cookie: "not-hex.x" });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).searchParams.get("next")).toBe("/settings");
  });
});

describe("Isolation between Tenants", () => {
  let cookieV: string;
  let tokenV: string;
  let keyA: string;
  let cookieA: string;
  let tokenA: string;

  beforeEach(async () => {
    cookieV = await setupInstance();
    tokenV = await apiToken(cookieV);
    keyA = await registerUser("ana", "ana pass");
    cookieA = cookieOf(await login("ana", "ana pass")) ?? "";
    tokenA = await apiToken(cookieA);
  });

  it("keeps bookmarks private to their Tenant", async () => {
    const created = await api(tokenV).post("/api/bookmarks/?disable_scraping", { url: "https://example.com/v" });
    expect(created.status).toBe(201);

    const listed = await api(tokenA).get("/api/bookmarks/");

    expect((await listed.json<{ count: number }>()).count).toBe(0);
    const page = await get("/bookmarks", { cookie: cookieA });
    expect(page.status).toBe(200);
    expect(await page.text()).not.toContain("example.com/v");
  });

  it("refuses a session replayed against another Tenant", async () => {
    const session = cookieV.slice(cookieV.indexOf(".") + 1);

    const response = await get("/settings", { cookie: `${keyA}.${session}` });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).searchParams.get("next")).toBe("/settings");
  });
});

describe("Directory storage", () => {
  it("applies migrations once", async () => {
    await get("/health");

    const versions = await runInDurableObject(directory(), (_directory, state) => {
      runDirectoryMigrations(state.storage.sql);
      return state.storage.sql
        .exec<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")
        .toArray()
        .map((row) => row.version);
    });

    expect(versions).toEqual(directoryMigrations.map((_, index) => index + 1));
  });
});
