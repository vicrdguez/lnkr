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
});
