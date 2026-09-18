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
