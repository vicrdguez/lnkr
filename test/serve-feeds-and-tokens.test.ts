import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, BASE, formPost, get, location, select, setupTenant } from "./helpers";

type Json = Record<string, unknown>;

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

/** The `<item>` bodies of an RSS document in order. */
const items = (xml: string): string[] => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);

/** The text of the first `<name>` element in `xml`, or undefined when there is none. */
const element = (xml: string, name: string): string | undefined => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];

describe("RSS feeds", () => {
  let feedToken: string;
  let token: string;

  beforeEach(async () => {
    token = await apiToken(cookie);
    const [all] = await feedUrls(await page("/settings"));
    feedToken = new URL(all).pathname.split("/")[2];
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
    await create("https://a.test/", { title: "A", unread: true });
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));
    await create("https://b.test/", { title: "B", description: "About B" });
    vi.setSystemTime(new Date("2026-09-03T00:00:00.000Z"));
    await create("https://c.test/", { title: "C", unread: true, is_archived: true });
  });

  /** Creates a bookmark through the API without touching the network. */
  async function create(url: string, fields: Json = {}): Promise<void> {
    expect((await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields })).status).toBe(201);
  }

  /** GETs the feed `kind` for the Tenant's feed token, without cookies. */
  const feed = (kind: string, query = "") => get(`/feeds/${feedToken}/${kind}${query}`);

  /** The body of the feed `kind`, expecting 200. */
  async function feedXml(kind: string, query = ""): Promise<string> {
    const response = await feed(kind, query);
    expect(response.status).toBe(200);
    return response.text();
  }

  const titles = (xml: string) => items(xml).map((item) => element(item, "title"));

  it("lists active bookmarks newest first as RSS 2.0", async () => {
    const response = await feed("all");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await response.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\s*<rss version="2.0">\s*<channel>/);
    expect(element(xml, "title")).toBe("All bookmarks");
    const fields = ["title", "link", "description", "pubDate"];
    expect(items(xml).map((item) => fields.map((name) => element(item, name)))).toEqual([
      ["B", "https://b.test/", "About B", "Wed, 02 Sep 2026 00:00:00 GMT"],
      ["A", "https://a.test/", "", "Tue, 01 Sep 2026 00:00:00 GMT"],
    ]);
    expect(xml).not.toContain("https://c.test/");
  });

  it("lists only active unread bookmarks on the unread feed", async () => {
    expect(titles(await feedXml("unread"))).toEqual(["A"]);
  });

  it("filters with the search grammar through q", async () => {
    await create("https://d.test/", { title: "D", tag_names: ["docs"] });

    expect(titles(await feedXml("all", "?q=%23docs"))).toEqual(["D"]);
  });

  it("caps the items with limit", async () => {
    expect(titles(await feedXml("all", "?limit=1"))).toEqual(["B"]);
  });

  it("serves at most 100 items by default", async () => {
    for (let n = 0; n < 99; n++) await create(`https://many.test/${n}`);

    expect(items(await feedXml("all"))).toHaveLength(100);
  });

  it.each([`/feeds/${"0".repeat(40)}/all`, "/feeds/all", "/feeds//all"])("answers 404 without a known token at %s", async (path) => {
    expect((await get(path)).status).toBe(404);
  });

  it.each<[string, number]>([
    ["all", 200],
    ["unread", 200],
    ["shared", 404],
    ["other", 404],
  ])("the %s feed answers %i", async (kind, status) => {
    expect((await feed(kind)).status).toBe(status);
  });

  it("escapes text and drops control characters", async () => {
    await create("https://tom.test/", { title: "Tom & Jerry <3", description: "a > b\u0001" });

    const xml = await feedXml("all");

    expect(xml).toContain("<title>Tom &amp; Jerry &lt;3</title>");
    expect(xml).toContain("<description>a &gt; b</description>");
  });

  it("titles a bookmark without a title by its URL", async () => {
    await create("https://e.test/", { title: "" });

    expect(titles(await feedXml("all"))[0]).toBe("https://e.test/");
  });
});
