/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/linkding-export.html?raw";
import { api, apiToken, filePost, formPost, get, setupTenant } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network and returns its JSON. */
async function create(fields: Json): Promise<Json> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", fields);
  expect(response.status).toBe(201);
  return response.json<Json>();
}

/** Every Bookmark, active then archived, as the API lists them. */
async function all(): Promise<Json[]> {
  const list = async (path: string) => ((await (await api(token).get(path)).json<Json>()).results as Json[]) ?? [];
  return [...(await list("/api/bookmarks/")), ...(await list("/api/bookmarks/archived/"))];
}

async function byUrl(url: string): Promise<Json> {
  const found = (await all()).find((bookmark) => bookmark.url === url);
  expect(found, url).toBeDefined();
  return found as Json;
}

/** The lines of the export, expecting 200. */
async function exportLines(): Promise<string[]> {
  const response = await get("/settings/export", { cookie });
  expect(response.status).toBe(200);
  return (await response.text()).split("\n");
}

/** The `<DT>` line whose HREF is `url`, or undefined. */
const entryFor = (lines: string[], url: string) => lines.find((line) => line.includes(`HREF="${url}"`));

describe("Export", () => {
  it("downloads the Netscape file", async () => {
    await create({ url: "https://example.com/one" });

    const response = await get("/settings/export", { cookie });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="bookmarks.html"');
    expect(await response.text()).toMatch(/^<!DOCTYPE NETSCAPE-Bookmark-file-1>\n/);
  });

  it("writes every attribute of an entry", async () => {
    vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
    const { id } = await create({
      url: "https://example.com/one",
      title: "One & only",
      description: "First <desc>",
      tag_names: ["beta", "alpha"],
      unread: true,
    });
    vi.setSystemTime(new Date("2023-11-14T23:13:20.000Z"));
    expect((await api(token).patch(`/api/bookmarks/${id}/`, { notes: "Line 1\nLine 2" })).status).toBe(200);

    const lines = await exportLines();

    const at = lines.indexOf(
      '<DT><A HREF="https://example.com/one" ADD_DATE="1700000000" LAST_MODIFIED="1700003600" PRIVATE="1" TOREAD="1" TAGS="alpha,beta">One &amp; only</A>',
    );
    expect(at, lines.join("\n")).toBeGreaterThan(0);
    expect(lines.slice(at + 1, at + 3)).toEqual(["<DD>First &lt;desc&gt;[linkding-notes]Line 1", "Line 2[/linkding-notes]"]);
  });

  it("appends the marker tag to archived bookmarks", async () => {
    await create({ url: "https://example.com/three", tag_names: ["alpha"], is_archived: true });

    const entry = entryFor(await exportLines(), "https://example.com/three");

    expect(entry).toContain('PRIVATE="1" TOREAD="0" TAGS="alpha,linkding:bookmarks.archived"');
  });

  it("writes a shared bookmark as not private", async () => {
    await create({ url: "https://example.com/two", shared: true });

    expect(entryFor(await exportLines(), "https://example.com/two")).toContain('PRIVATE="0"');
  });

  it("writes no DD line without a description or notes", async () => {
    await create({ url: "https://example.com/bare", title: "Bare" });

    const lines = await exportLines();

    const at = lines.findIndex((line) => line.includes('HREF="https://example.com/bare"'));
    expect(lines[at + 1]).toBe("</DL><p>");
  });

  it("lists oldest first", async () => {
    for (const day of [14, 15, 13]) {
      vi.setSystemTime(new Date(`2023-11-${day}T12:00:00.000Z`));
      await create({ url: `https://example.com/${day}` });
    }

    const urls = (await exportLines()).flatMap((line) => line.match(/HREF="([^"]+)"/)?.[1] ?? []);

    expect(urls).toEqual(["https://example.com/13", "https://example.com/14", "https://example.com/15"]);
  });

  it("uses the URL as the title of an untitled bookmark", async () => {
    await create({ url: "https://example.com/untitled" });

    expect(entryFor(await exportLines(), "https://example.com/untitled")).toMatch(/>https:\/\/example\.com\/untitled<\/A>$/);
  });
});

/** Uploads `html` as the `file` part, with the checkbox when `mapPrivateFlag`. */
function importFile(html: string, mapPrivateFlag = false): Promise<Response> {
  const form = new FormData();
  form.set("file", new File([html], "bookmarks.html", { type: "text/html" }));
  if (mapPrivateFlag) form.set("map_private_flag", "on");
  return filePost("/settings/import", form, { cookie });
}

/** Imports `html` expecting 200 and returns the page text. */
async function imported(html: string, mapPrivateFlag = false): Promise<string> {
  const response = await importFile(html, mapPrivateFlag);
  expect(response.status).toBe(200);
  return response.text();
}

/** A minimal Netscape file around `entries`. */
const file = (...entries: string[]) => `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n${entries.join("\n")}\n</DL><p>\n`;

const tagNames = async () => ((await (await api(token).get("/api/tags/")).json<Json>()).results as Json[]).map((t) => t.name);

describe("Import", () => {
  it("creates bookmarks from a linkding export", async () => {
    expect(await imported(fixture)).toContain("3 created, 0 updated, 0 skipped");

    const active = await (await api(token).get("/api/bookmarks/")).json<Json>();
    expect(active.count).toBe(2);
    expect((active.results as Json[]).map((b) => b.url)).toEqual(["https://example.com/two", "https://example.com/one"]);
    expect(await byUrl("https://example.com/one")).toMatchObject({
      title: "One & only",
      description: "First <desc>",
      notes: "Line 1\nLine 2",
      tag_names: ["alpha", "beta"],
      unread: true,
      shared: false,
      date_added: "2023-11-14T22:13:20.000Z",
      date_modified: "2023-11-14T23:13:20.000Z",
    });
    const archived = await (await api(token).get("/api/bookmarks/archived/")).json<Json>();
    expect(archived.results).toHaveLength(1);
    expect((archived.results as Json[])[0]).toMatchObject({ url: "https://example.com/three", tag_names: ["alpha"] });
  });

  it("does not store the marker tag", async () => {
    await imported(fixture);

    expect(await tagNames()).toEqual(["alpha", "beta"]);
  });

  it("changes nothing on re-import", async () => {
    await imported(fixture);

    expect(await imported(fixture)).toContain("0 created, 3 updated, 0 skipped");

    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(2);
    expect((await (await api(token).get("/api/tags/")).json<Json>()).count).toBe(2);
  });

  it("updates an existing URL and merges its tags", async () => {
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
    await create({ url: "https://example.com/one", title: "Old", tag_names: ["gamma"] });
    vi.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));

    expect(await imported(fixture)).toContain("2 created, 1 updated, 0 skipped");

    expect(await byUrl("https://example.com/one")).toMatchObject({
      title: "One & only",
      tag_names: ["alpha", "beta", "gamma"],
      unread: true,
      date_added: "2020-01-01T00:00:00.000Z",
    });
  });

  it.each([
    ["absent", false],
    ["on", true],
  ])("maps the private flag to shared only when the option is %s", async (_, option) => {
    await imported(fixture, option);

    expect((await byUrl("https://example.com/two")).shared).toBe(option);
    expect((await byUrl("https://example.com/one")).shared).toBe(false);
  });

  it("skips invalid URLs", async () => {
    const html = file('<DT><A HREF="https://ok.test/">Ok</A>', '<DT><A HREF="not a url">Bad</A>', '<DT><A HREF="ftp://x.test/">Ftp</A>');

    expect(await imported(html)).toContain("1 created, 0 updated, 2 skipped");

    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(1);
  });

  it("defaults missing attributes", async () => {
    vi.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));

    await imported(file('<DT><A HREF="https://plain.test/">Plain</A>'));

    expect(await byUrl("https://plain.test/")).toMatchObject({
      title: "Plain",
      tag_names: [],
      unread: false,
      is_archived: false,
      date_added: "2026-09-11T10:00:00.000Z",
    });
  });

  it("ignores folders", async () => {
    const html = file(
      '<DT><A HREF="https://a.test/">A</A>',
      "<DD>Desc of A",
      "<DT><H3>Folder</H3>",
      "<DL><p>",
      '<DT><A HREF="https://b.test/">B</A>',
      "</DL><p>",
    );

    expect(await imported(html)).toContain("2 created, 0 updated, 0 skipped");

    expect((await byUrl("https://a.test/")).description).toBe("Desc of A");
    expect(await byUrl("https://b.test/")).toMatchObject({ title: "B", description: "" });
    expect(await tagNames()).toEqual([]);
  });

  it("refuses a missing file", async () => {
    expect((await formPost("/settings/import", {}, { cookie })).status).toBe(400);
    expect((await filePost("/settings/import", new FormData(), { cookie })).status).toBe(400);
  });
});

describe("Round trip", () => {
  it("exports an imported fixture byte for byte", async () => {
    await imported(fixture, true);

    const response = await get("/settings/export", { cookie });

    expect(await response.text()).toBe(fixture);
  });
});
