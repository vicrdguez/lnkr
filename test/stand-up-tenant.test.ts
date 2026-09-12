import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { migrations, runMigrations } from "../src/db/schema";
import { cookieOf, formPost, get, location, PASSWORD, USERNAME } from "./helpers";

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
