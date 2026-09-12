import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { migrations, runMigrations } from "../src/db/schema";
import { get } from "./helpers";

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
