import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, BASE, formPost, get, location, select, setupTenant } from "./helpers";

let cookie: string;

beforeEach(async () => {
  cookie = await setupTenant();
});

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

/** POSTs the create-token form. */
const createToken = (name: string) => formPost("/settings/tokens", { name }, { cookie });

/** The key in the new-token box of `html`, or undefined when the page has none. */
async function newKey(html: string): Promise<string | undefined> {
  const [code] = await select(html, "#new-token");
  return code?.text;
}

describe("Named API tokens", () => {
  it("shows the key once on creation", async () => {
    const response = await createToken("laptop");

    expect(response.status).toBe(200);
    const html = await response.text();
    const key = await newKey(html);
    expect(key).toMatch(/^[0-9a-f]{40}$/);
    expect(html).toContain("laptop");
    expect((await api(key).get("/api/user/profile/")).status).toBe(200);
    const settings = await page("/settings");
    expect(settings).toContain("laptop");
    expect(settings).not.toContain(key);
  });

  it("lists tokens by name and date with a Revoke button each", async () => {
    vi.setSystemTime(new Date("2026-09-01T10:30:00.000Z"));
    await createToken("laptop");
    vi.setSystemTime(new Date("2026-09-02T11:00:00.000Z"));
    await createToken("phone");

    const html = await page("/settings");

    expect((await select(html, "#api-tokens .name")).map((name) => name.text)).toEqual(["laptop", "phone"]);
    expect((await select(html, "#api-tokens time")).map((time) => time.text)).toEqual(["2026-09-01 10:30", "2026-09-02 11:00"]);
    expect((await select(html, "#api-tokens button")).map((button) => button.text)).toEqual(["Revoke", "Revoke"]);
  });

  it("requires a name", async () => {
    const response = await createToken("  ");

    expect(response.status).toBe(400);
    expect((await select(await response.text(), ".error")).map((error) => error.text)).toEqual(["A token needs a name."]);
    expect(await select(await page("/settings"), "#api-tokens li")).toEqual([]);
  });

  it("revokes a token", async () => {
    const key = await newKey(await (await createToken("laptop")).text());
    const [form] = await select(await page("/settings"), "#api-tokens form");
    expect(form.attrs.action).toMatch(/^\/settings\/tokens\/\d+\/revoke$/);

    const response = await formPost(form.attrs.action, {}, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/settings");
    expect(await select(await page("/settings"), "#api-tokens li")).toEqual([]);
    expect((await api(key).get("/api/user/profile/")).status).toBe(401);
  });

  it("lists a token from before named tokens as Default and keeps it working", async () => {
    const key = "0".repeat(39) + "1";
    const stub = env.TENANT.get(env.TENANT.idFromName("main"));
    await runInDurableObject(stub, (_tenant, state) => {
      state.storage.sql.exec("INSERT INTO api_tokens (key, created) VALUES (?, ?)", key, "2026-08-01T00:00:00.000Z");
    });

    const html = await page("/settings");

    expect((await select(html, "#api-tokens .name")).map((name) => name.text)).toEqual(["Default"]);
    expect(html).not.toContain(key);
    expect((await api(key).get("/api/user/profile/")).status).toBe(200);
  });
});

/** The `all` and `unread` feed URLs on the settings page. */
async function feedUrls(html: string): Promise<[string, string]> {
  const [all] = await select(html, "#feed-all");
  const [unread] = await select(html, "#feed-unread");
  return [all.attrs.href, unread.attrs.href];
}

describe("Feed token", () => {
  it("is shown as two feed URLs", async () => {
    const [all, unread] = await feedUrls(await page("/settings"));

    expect(all).toMatch(new RegExp(`^${BASE}/feeds/[0-9a-f]{40}/all$`));
    expect(unread).toBe(all.replace(/all$/, "unread"));
  });

  it("is stable across views", async () => {
    const first = await feedUrls(await page("/settings"));

    expect(await feedUrls(await page("/settings"))).toEqual(first);
  });
});
