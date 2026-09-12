import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrations, runMigrations } from "../src/db/schema";
import {
  BASE,
  cookieAttributes,
  cookieOf,
  formPost,
  get,
  location,
  login,
  PASSWORD,
  setupTenant,
  USERNAME,
} from "./helpers";

describe("Health", () => {
  it("is public", async () => {
    const response = await get("/health");

    expect(response.status).toBe(200);
    const body = await response.json<{ status: string; version: string }>();
    expect(body.status).toBe("healthy");
    expect(body.version).not.toBe("");
  });
});

describe("Schema migrations", () => {
  it("applies once", async () => {
    await get("/health");
    const stub = env.TENANT.get(env.TENANT.idFromName("main"));

    const versions = await runInDurableObject(stub, (_tenant, state) => {
      runMigrations(state.storage.sql);
      return state.storage.sql
        .exec<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version")
        .toArray()
        .map((row) => row.version);
    });

    expect(versions).toEqual(migrations.map((_, index) => index + 1));
  });
});

describe("First-run setup", () => {
  it("offers the setup form on a fresh Instance", async () => {
    const response = await get("/setup");

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('name="username"');
    expect(html).toContain('name="password"');
  });

  it("creates the user and starts a session", async () => {
    const response = await formPost("/setup", { username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/");
    const cookie = cookieOf(response);
    expect(cookie).toBeTruthy();
    expect((await get("/settings", cookie)).status).toBe(200);
  });

  it.each([
    ["", "secret"],
    ["vic", ""],
  ])("rejects missing fields (username %j, password %j)", async (username, password) => {
    const response = await formPost("/setup", { username, password });

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('name="username"');
    expect(html).toContain('role="alert"');
    expect((await get("/setup")).status).toBe(200);
  });
});

describe("First-run setup, once a user exists", () => {
  it.each(["GET", "POST"])("is closed (%s)", async (method) => {
    await setupTenant();

    const response =
      method === "GET" ? await get("/setup") : await formPost("/setup", { username: "eve", password: "secret" });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect((await login("eve", "secret")).status).toBe(401);
    expect((await login(USERNAME, PASSWORD)).status).toBe(302);
  });
});

describe("Password login", () => {
  beforeEach(async () => {
    await setupTenant();
  });

  it("redirects a protected page to login", async () => {
    const response = await get("/settings");

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).searchParams.get("next")).toBe("/settings");
  });

  it("starts a session with correct credentials", async () => {
    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/");
    expect(cookieAttributes(response)).toEqual(
      expect.arrayContaining(["httponly", "samesite=lax", "path=/", "max-age=1209600"]),
    );
    expect((await get("/settings", cookieOf(response))).status).toBe(200);
  });

  it.each([
    ["https", true],
    ["http", false],
  ])("sets the Secure flag by request scheme (%s)", async (scheme, secure) => {
    const response = await login(USERNAME, PASSWORD, { base: `${scheme}://lnkr.test` });

    expect(cookieAttributes(response).includes("secure")).toBe(secure);
  });

  it("honours a same-origin next path", async () => {
    const response = await formPost("/login?next=/settings", { username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/settings`);
  });

  it("ignores a next pointing at another origin", async () => {
    const response = await formPost("/login?next=https://evil.example/", { username: USERNAME, password: PASSWORD });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/`);
  });

  it.each([
    [USERNAME, "wrong"],
    ["nobody", PASSWORD],
  ])("refuses wrong credentials (%s / %s)", async (username, password) => {
    const response = await login(username, password);

    expect(response.status).toBe(401);
    const html = await response.text();
    expect(html).toContain("Invalid username or password");
    expect(html).toContain('name="username"');
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("redirects root by session", async () => {
    const cookie = cookieOf(await login(USERNAME, PASSWORD));

    const loggedIn = await get("/", cookie);
    expect(loggedIn.status).toBe(302);
    expect(location(loggedIn).href).toBe(`${BASE}/settings`);

    const anonymous = await get("/");
    expect(anonymous.status).toBe(302);
    expect(location(anonymous).href).toBe(`${BASE}/login`);
  });
});

describe("Session lifecycle", () => {
  let cookie: string;

  beforeEach(async () => {
    cookie = await setupTenant();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends the session on logout", async () => {
    const response = await formPost("/logout", {}, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect(cookieAttributes(response)).toContain("max-age=0");

    const afterwards = await get("/settings", cookie);
    expect(afterwards.status).toBe(302);
    expect(location(afterwards).searchParams.get("next")).toBe("/settings");
  });

  it("rejects an expired session", async () => {
    vi.setSystemTime(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const response = await get("/settings", cookie);

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/login");
    expect(location(response).searchParams.get("next")).toBe("/settings");
  });
});

describe("Login attempt limiter", () => {
  beforeEach(async () => {
    await setupTenant();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function failLogins(times: number) {
    for (let i = 0; i < times; i++) expect((await login(USERNAME, "wrong")).status).toBe(401);
  }

  it("refuses the sixth attempt even with the right password", async () => {
    await failLogins(5);

    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(429);
    expect(await response.text()).toContain("Too many attempts. Try again later.");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("lifts the lock when the window ends", async () => {
    await failLogins(5);
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);

    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/");
    expect(cookieOf(response)).toBeTruthy();
  });

  it("resets the count on a successful login", async () => {
    await failLogins(4);
    expect((await login(USERNAME, PASSWORD)).status).toBe(302);
    await failLogins(4);

    const response = await login(USERNAME, PASSWORD);

    expect(response.status).toBe(302);
    expect(cookieOf(response)).toBeTruthy();
  });
});

describe("Change password", () => {
  const NEW_PASSWORD = "new pass phrase";
  let cookie: string;

  beforeEach(async () => {
    cookie = await setupTenant();
  });

  it("changes with the current password", async () => {
    const response = await formPost(
      "/settings/password",
      { current: PASSWORD, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
      { cookie },
    );

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/settings");
    expect(cookieOf(await login(USERNAME, NEW_PASSWORD))).toBeTruthy();
    expect((await login(USERNAME, PASSWORD)).status).toBe(401);
  });

  it.each([
    ["wrong current password", { current: "wrong", password: NEW_PASSWORD, confirm: NEW_PASSWORD }],
    ["mismatched confirmation", { current: PASSWORD, password: NEW_PASSWORD, confirm: "other" }],
  ])("rejects a %s", async (_case, fields) => {
    const response = await formPost("/settings/password", fields, { cookie });

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('name="current"');
    expect(html).toContain('role="alert"');
    expect(cookieOf(await login(USERNAME, PASSWORD))).toBeTruthy();
  });
});
