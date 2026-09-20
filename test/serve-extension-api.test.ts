import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pkg from "../package.json";
import { api, apiToken, get, mockPage, setupTenant } from "./helpers";
import { network } from "./network";

type Json = Record<string, unknown>;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark without touching the network and returns its JSON. */
async function create(fields: Json): Promise<Json> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", fields);
  expect(response.status).toBe(201);
  return response.json<Json>();
}

async function getBookmark(id: unknown): Promise<Json> {
  return (await api(token).get(`/api/bookmarks/${id}/`)).json<Json>();
}

describe("API authentication", () => {
  it("refuses a missing token", async () => {
    const response = await api().get("/api/bookmarks/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Authentication credentials were not provided." });
  });

  it("refuses an unknown token", async () => {
    const response = await api("0".repeat(40)).get("/api/bookmarks/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Invalid token." });
  });

  it("ignores session cookies", async () => {
    const response = await get("/api/bookmarks/", { cookie });

    expect(response.status).toBe(401);
  });
});

describe("User profile", () => {
  it("answers linkding's fields", async () => {
    const response = await api(token).get("/api/user/profile/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      theme: "auto",
      bookmark_date_display: "relative",
      bookmark_link_target: "_blank",
      web_archive_integration: "disabled",
      tag_search: "strict",
      enable_sharing: false,
      enable_public_sharing: false,
      enable_favicons: false,
      display_url: false,
      permanent_notes: false,
      search_preferences: { sort: "added_desc", shared: "off", unread: "off" },
      version: pkg.version,
    });
  });
});

describe("Create bookmarks", () => {
  it("creates with every field", async () => {
    const response = await api(token).post("/api/bookmarks/", {
      url: "https://example.com/a",
      title: "A",
      description: "About A",
      notes: "n",
      is_archived: false,
      unread: true,
      shared: false,
      tag_names: ["Alpha", "beta"],
    });

    expect(response.status).toBe(201);
    const body = await response.json<Json>();
    expect(Object.keys(body)).toEqual([
      "id",
      "url",
      "title",
      "description",
      "notes",
      "web_archive_snapshot_url",
      "favicon_url",
      "preview_image_url",
      "is_archived",
      "unread",
      "shared",
      "tag_names",
      "date_added",
      "date_modified",
    ]);
    expect(body).toMatchObject({
      url: "https://example.com/a",
      title: "A",
      description: "About A",
      notes: "n",
      web_archive_snapshot_url: "",
      favicon_url: null,
      preview_image_url: null,
      is_archived: false,
      unread: true,
      shared: false,
      tag_names: ["Alpha", "beta"],
    });
    expect(body.date_added).toMatch(ISO_UTC);
    expect(body.date_modified).toMatch(ISO_UTC);
    const tags = await (await api(token).get("/api/tags/")).json<{ results: { name: string }[] }>();
    expect(tags.results.map((tag) => tag.name)).toEqual(["Alpha", "beta"]);
  });

  it("trims and deduplicates tag names regardless of case", async () => {
    const response = await api(token).post("/api/bookmarks/", {
      url: "https://example.com/a",
      tag_names: [" go ", "Go", "rust"],
    });

    expect(response.status).toBe(201);
    expect((await response.json<Json>()).tag_names).toEqual(["go", "rust"]);
    const tags = await (await api(token).get("/api/tags/")).json<{ count: number }>();
    expect(tags.count).toBe(2);
  });

  it("updates the bookmark with an existing url instead of duplicating it", async () => {
    const first = await (await api(token).post("/api/bookmarks/", { url: "https://example.com/a", title: "A" })).json<Json>();

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/a", title: "A2" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: first.id, title: "A2" });
    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(1);
  });

  it("fills an empty title and description from the page", async () => {
    mockPage("https://example.com/p", '<title>Page P</title><meta name="description" content="Desc P">');

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/p" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "Page P", description: "Desc P" });
  });

  it("stores the page's title and description with character references decoded", async () => {
    mockPage(
      "https://example.com/refs",
      '<meta property="og:title" content="AT&amp;T"><meta property="og:description" content="Q&amp;A &#39;quoted&#39;">',
    );

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/refs" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "AT&T", description: "Q&A 'quoted'" });
  });

  it("keeps provided fields over the page's", async () => {
    mockPage("https://example.com/p", "<title>Page P</title>");

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/p", title: "Mine" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "Mine" });
  });

  it("skips the page fetch with disable_scraping", async () => {
    let requests = 0;
    network.use(
      http.all("*", () => {
        requests++;
        return HttpResponse.error();
      }),
    );

    const response = await api(token).post("/api/bookmarks/?disable_scraping", { url: "https://example.com/q" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "" });
    expect(requests).toBe(0);
  });

  it("leaves fields empty when the page is unreachable", async () => {
    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/down" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "", description: "" });
  });

  it.each(["", "not a url", "ftp://example.com", "javascript:alert(1)"])("refuses the invalid url %j", async (url) => {
    const response = await api(token).post("/api/bookmarks/", { url });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ url: ["Enter a valid URL."] });
    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(0);
  });
});

describe("List bookmarks", () => {
  let second: Json;

  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-09-11T08:00:00.000Z"));
    await create({ url: "https://example.com/1", is_archived: true });
    vi.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));
    second = await create({ url: "https://example.com/2" });
    vi.setSystemTime(new Date("2026-09-11T12:00:00.000Z"));
    await create({ url: "https://example.com/3" });
  });

  const urls = (body: Json) => (body.results as Json[]).map((bookmark) => bookmark.url);

  /** Modifies /2 after /3 was added, so its modification time no longer equals its creation time. */
  async function modifySecondLater(): Promise<void> {
    vi.setSystemTime(new Date("2026-09-11T14:00:00.000Z"));
    expect((await api(token).patch(`/api/bookmarks/${second.id}/`, { notes: "n" })).status).toBe(200);
  }

  it("excludes archived bookmarks and orders newest first", async () => {
    const body = await (await api(token).get("/api/bookmarks/")).json<Json>();

    expect(body.count).toBe(2);
    expect(urls(body)).toEqual(["https://example.com/3", "https://example.com/2"]);
    expect(body.next).toBeNull();
    expect(body.previous).toBeNull();
  });

  it("lists only archived bookmarks under archived/", async () => {
    const body = await (await api(token).get("/api/bookmarks/archived/")).json<Json>();

    expect(body.count).toBe(1);
    expect(urls(body)).toEqual(["https://example.com/1"]);
  });

  it("paginates with limit and offset and absolute links", async () => {
    const first = await (await api(token).get("/api/bookmarks/?limit=1")).json<Json>();
    expect(urls(first)).toEqual(["https://example.com/3"]);
    expect(first.count).toBe(2);
    expect(first.next).toBe("https://lnkr.test/api/bookmarks/?limit=1&offset=1");
    expect(first.previous).toBeNull();

    const second = await (await api(token).get("/api/bookmarks/?limit=1&offset=1")).json<Json>();
    expect(urls(second)).toEqual(["https://example.com/2"]);
    expect(second.next).toBeNull();
    expect(second.previous).toBe("https://lnkr.test/api/bookmarks/?limit=1");
  });

  it("filters by modified_since", async () => {
    const body = await (await api(token).get("/api/bookmarks/?modified_since=2026-09-11T11:00:00Z")).json<Json>();
    expect(urls(body)).toEqual(["https://example.com/3"]);

    await modifySecondLater();

    const later = await (await api(token).get("/api/bookmarks/?modified_since=2026-09-11T13:00:00Z")).json<Json>();
    expect(urls(later)).toEqual(["https://example.com/2"]);
  });

  it("filters by added_since", async () => {
    const body = await (await api(token).get("/api/bookmarks/?added_since=2026-09-11T11:00:00Z")).json<Json>();
    expect(urls(body)).toEqual(["https://example.com/3"]);

    await modifySecondLater();

    const later = await (await api(token).get("/api/bookmarks/?added_since=2026-09-11T11:00:00Z")).json<Json>();
    expect(urls(later)).toEqual(["https://example.com/3"]);
  });
});

describe("Read, update and delete a bookmark", () => {
  let created: Json;

  beforeEach(async () => {
    created = await create({ url: "https://example.com/a", title: "A", notes: "n", tag_names: ["x"], unread: true });
  });

  it("gets by id", async () => {
    const response = await api(token).get(`/api/bookmarks/${created.id}/`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  it("answers 404 for an unknown id", async () => {
    const response = await api(token).get("/api/bookmarks/999/");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Not found." });
  });

  it("replaces every field on PUT, resetting omitted ones", async () => {
    vi.setSystemTime(Date.now() + 1000);

    const response = await api(token).put(`/api/bookmarks/${created.id}/`, { url: "https://example.com/a", title: "A3" });

    expect(response.status).toBe(200);
    const body = await response.json<Json>();
    expect(body).toMatchObject({ title: "A3", notes: "", tag_names: [], unread: false });
    expect(body.date_modified as string > (created.date_modified as string)).toBe(true);
  });

  it("changes only the given fields on PATCH", async () => {
    vi.setSystemTime(Date.now() + 1000);

    const response = await api(token).patch(`/api/bookmarks/${created.id}/`, { notes: "n2" });

    expect(response.status).toBe(200);
    const body = await response.json<Json>();
    expect(body).toMatchObject({ notes: "n2", title: "A", tag_names: ["x"], unread: true });
    expect(body.date_modified as string > (created.date_modified as string)).toBe(true);
  });

  it("requires a url on PUT", async () => {
    const response = await api(token).put(`/api/bookmarks/${created.id}/`, { title: "A3" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ url: ["This field is required."] });
  });

  it("refuses moving the url onto another bookmark", async () => {
    await create({ url: "https://example.com/b" });

    const response = await api(token).patch(`/api/bookmarks/${created.id}/`, { url: "https://example.com/b" });

    expect(response.status).toBe(400);
    expect((await response.json<Json>()).url).toBeDefined();
    expect((await getBookmark(created.id)).url).toBe("https://example.com/a");
  });

  it("deletes", async () => {
    const response = await api(token).del(`/api/bookmarks/${created.id}/`);

    expect(response.status).toBe(204);
    expect((await api(token).get(`/api/bookmarks/${created.id}/`)).status).toBe(404);
  });

  it("archives and unarchives", async () => {
    expect((await api(token).post(`/api/bookmarks/${created.id}/archive/`)).status).toBe(204);
    expect((await getBookmark(created.id)).is_archived).toBe(true);

    expect((await api(token).post(`/api/bookmarks/${created.id}/unarchive/`)).status).toBe(204);
    expect((await getBookmark(created.id)).is_archived).toBe(false);
  });

  it.each([
    ["DELETE", ""],
    ["POST", "archive/"],
    ["POST", "unarchive/"],
    ["PATCH", ""],
  ])("answers 404 for %s on an unknown id (%s)", async (method, suffix) => {
    const client = api(token);
    const send = { DELETE: client.del, POST: client.post, PATCH: client.patch }[method]!;

    const response = await send(`/api/bookmarks/999/${suffix}`, method === "PATCH" ? { notes: "x" } : undefined);

    expect(response.status).toBe(404);
  });
});

describe("Check a URL", () => {
  it("returns the bookmark for a known url", async () => {
    const bookmark = await create({ url: "https://example.com/a" });

    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/a")).json<Json>();

    expect(body.bookmark).toEqual(bookmark);
    expect(body.auto_tags).toEqual([]);
  });

  it("returns page metadata for an unknown url", async () => {
    mockPage("https://example.com/new", '<title>New</title><meta property="og:description" content="OG desc">');

    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/new")).json<Json>();

    expect(body).toEqual({ bookmark: null, metadata: { title: "New", description: "OG desc" }, auto_tags: [] });
  });

  it("returns null metadata for an unreachable page", async () => {
    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/down")).json<Json>();

    expect(body).toEqual({ bookmark: null, metadata: { title: null, description: null }, auto_tags: [] });
  });

  it("prefers the title element over og:title", async () => {
    mockPage("https://example.com/og", '<title>Real</title><meta property="og:title" content="OG">');

    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/og")).json<Json>();

    expect((body.metadata as Json).title).toBe("Real");
  });

  it("decodes named, decimal and hexadecimal character references as a browser would", async () => {
    // &copy2024 is a legacy reference in text but not in an attribute; &#150; is a C1 code remapped by HTML.
    mockPage(
      "https://example.com/refs",
      '<title>Foo &amp; Bar &lt;3 &#8211; &#x1F600; &copy2024</title>' +
        '<meta name="description" content="A &quot;q&quot; &amp; B &eacute; &#150; ?x=1&copy=2">',
    );

    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/refs")).json<Json>();

    expect(body.metadata).toEqual({ title: "Foo & Bar <3 – 😀 ©2024", description: 'A "q" & B é – ?x=1&copy=2' });
  });

  it("reads only the first title element", async () => {
    mockPage("https://example.com/svg", "<title>Page</title><svg><title>Icon</title></svg>");

    const body = await (await api(token).get("/api/bookmarks/check/?url=https://example.com/svg")).json<Json>();

    expect((body.metadata as Json).title).toBe("Page");
  });

  it("requires the url parameter", async () => {
    const response = await api(token).get("/api/bookmarks/check/");

    expect(response.status).toBe(400);
  });

  it("refuses a url that is not http or https", async () => {
    const response = await api(token).get("/api/bookmarks/check/?url=javascript:alert(1)");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ url: ["Enter a valid URL."] });
  });
});

describe("Tags", () => {
  it("lists, creates and gets", async () => {
    const response = await api(token).post("/api/tags/", { name: "docs" });

    expect(response.status).toBe(201);
    const tag = await response.json<Json>();
    expect(Object.keys(tag)).toEqual(["id", "name", "date_added"]);
    expect(tag.name).toBe("docs");
    const list = await (await api(token).get("/api/tags/")).json<Json>();
    expect(list.count).toBe(1);
    expect(list.results).toEqual([tag]);
    expect(await (await api(token).get(`/api/tags/${tag.id}/`)).json()).toEqual(tag);
  });

  it("returns the existing tag when creating its name in another case", async () => {
    const existing = await (await api(token).post("/api/tags/", { name: "docs" })).json<Json>();

    const response = await api(token).post("/api/tags/", { name: "Docs" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: existing.id, name: "docs" });
  });

  it("removes a deleted tag from its bookmarks", async () => {
    const bookmark = await create({ url: "https://example.com/a", tag_names: ["docs", "x"] });
    const docs = (await (await api(token).get("/api/tags/")).json<{ results: Json[] }>()).results.find(
      (tag) => tag.name === "docs",
    )!;

    const response = await api(token).del(`/api/tags/${docs.id}/`);

    expect(response.status).toBe(204);
    expect((await getBookmark(bookmark.id)).tag_names).toEqual(["x"]);
  });
});
