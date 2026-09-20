import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, BASE, filePost, formPost, get, jsonPost, location, parseSse, select, setupTenant } from "./helpers";
import { network } from "./network";

type Json = Record<string, unknown>;

const RENDER = "https://api.cloudflare.com/client/v4/accounts/acc/browser-rendering/content";
const DATASTAR = { "datastar-request": "true" };
/** The active list's page signals as the page declares them. */
const ACTIVE = { q: "", sort: "added_desc", unread: "", page: 1, archived: false };
const KEPT = "<html><head><title>A</title></head><body>kept</body></html>";

let cookie: string;
let token: string;
/** The Bookmark `B` of the background. */
let id: number;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
  id = await create("https://example.com/a");
});

/** Creates a bookmark through the API without touching the network and returns its id. */
async function create(url: string, query = "?disable_scraping"): Promise<number> {
  const response = await api(token).post(`/api/bookmarks/${query}`, { url });
  expect(response.status).toBe(201);
  return (await response.json<{ id: number }>()).id;
}

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

type RenderCall = { authorization: string | null; body: unknown };

/** Serves `html` as a successful render for the rest of the test; every call lands in the returned list. */
function mockRender(html: string): RenderCall[] {
  const calls: RenderCall[] = [];
  network.use(
    http.post(RENDER, async ({ request }) => {
      calls.push({ authorization: request.headers.get("authorization"), body: await request.json() });
      return HttpResponse.json({ success: true, result: html });
    }),
  );
  return calls;
}

/** Posts the Snapshot action as Datastar does and returns the patched elements, expecting one SSE patch. */
async function snapshot(bookmark = id): Promise<string> {
  const response = await jsonPost(`/bookmarks/${bookmark}/snapshot`, ACTIVE, { cookie, headers: DATASTAR });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  const patches = parseSse(await response.text()).filter((event) => event.event === "datastar-patch-elements");
  expect(patches).toHaveLength(1);
  return patches[0].data.elements;
}

/** The date link's href of bookmark `bookmark` in `html`. */
const dateLink = async (html: string, bookmark = id) => (await select(html, `#bookmark-${bookmark} a.date`))[0].attrs.href;

/** The Bookmark's assets as the API lists them. */
const assets = async (bookmark = id) =>
  (await api(token).get(`/api/bookmarks/${bookmark}/assets/`)).json<{ count: number; results: Json[] }>();

describe("Take a snapshot from the list", () => {
  it("offers a Snapshot button on the list item", async () => {
    const html = await page("/bookmarks");

    const button = (await select(html, `#bookmark-${id} button`)).find((b) => b.text === "Snapshot");
    expect(button?.attrs["data-on:click"]).toBe(`@post('/bookmarks/${id}/snapshot')`);
  });

  it("renders the page and stores it", async () => {
    const calls = mockRender(KEPT);

    const html = await snapshot();

    expect(calls).toEqual([{ authorization: "Bearer tok", body: { url: "https://example.com/a" } }]);
    expect(html).toContain(`<li id="bookmark-${id}"`);
    expect(await dateLink(html)).toBe("/assets/1");
    const stored = await get("/assets/1", { cookie });
    expect(stored.status).toBe(200);
    expect(await stored.text()).toContain("kept");
  });

  it("links the date to the latest completed snapshot", async () => {
    mockRender(KEPT);
    await snapshot();

    const html = await page("/bookmarks");

    expect(await dateLink(html)).toBe("/assets/1");
    const count = (await select(html, `#bookmark-${id} a`)).find((a) => a.text === "1 snapshot");
    expect(count?.attrs.href).toBe(`/bookmarks/${id}/edit#snapshots`);
  });

  it("records a failed render as failure", async () => {
    network.use(http.post(RENDER, () => HttpResponse.json({ success: false, errors: [{ message: "boom" }] }, { status: 500 })));

    const html = await snapshot();

    expect(html).toContain("Snapshot failed");
    const found = await assets();
    expect(found.count).toBe(1);
    expect(found.results[0].status).toBe("failure");
    expect(await dateLink(html)).toContain("https://web.archive.org/web/");
  });

  it("records an unreachable renderer as failure", async () => {
    const html = await snapshot();

    expect(html).toContain("Snapshot failed");
    expect((await assets()).results[0].status).toBe("failure");
  });

  it("refuses a second snapshot within ten seconds without calling out", async () => {
    const calls = mockRender(KEPT);
    const start = Date.now();
    vi.setSystemTime(start);
    await snapshot();
    vi.setSystemTime(start + 5_000);

    const html = await snapshot();

    expect(html).toContain("Wait ten seconds between snapshots");
    expect(calls).toHaveLength(1);
    expect((await assets()).count).toBe(1);
  });

  it("takes a new snapshot after ten seconds, which becomes the latest", async () => {
    mockRender(KEPT);
    const start = Date.now();
    vi.setSystemTime(start);
    await snapshot();
    vi.setSystemTime(start + 11_000);
    mockRender("<html>second</html>");

    const html = await snapshot();

    expect((await assets()).results.map((asset) => [asset.id, asset.status])).toEqual([[2, "complete"], [1, "complete"]]);
    expect(await dateLink(html)).toBe("/assets/2");
    expect(await (await get("/assets/2", { cookie })).text()).toBe("<html>second</html>");
  });

  it("returns to the list after a plain form post", async () => {
    mockRender(KEPT);

    const response = await formPost(`/bookmarks/${id}/snapshot`, {}, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const found = await assets();
    expect(found.count).toBe(1);
    expect(found.results[0].status).toBe("complete");
  });
});

describe("View and delete snapshots", () => {
  const STORED = "<html><body>kept</body></html>";

  /** The background: `B` has the completed Snapshot 1 holding `STORED`. */
  beforeEach(async () => {
    mockRender(STORED);
    await snapshot();
  });

  it("serves a snapshot sandboxed", async () => {
    const response = await get("/assets/1", { cookie });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(STORED);
  });

  it("needs a session to view", async () => {
    const response = await get("/assets/1");

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/login?next=%2Fassets%2F1`);
  });

  it("answers 404 for an unknown asset", async () => {
    expect((await get("/assets/999", { cookie })).status).toBe(404);
  });

  it("lists snapshots on the edit page", async () => {
    const html = await page(`/bookmarks/${id}/edit`);

    const [section] = await select(html, "section#snapshots");
    expect(section.text).toContain("complete");
    expect((await select(html, "#snapshots a")).map((a) => a.attrs.href)).toContain("/assets/1");
    expect((await select(html, "#snapshots form")).map((form) => form.attrs.action)).toEqual(["/assets/1/delete"]);
  });
});
