import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, setupTenant } from "./helpers";

type Json = Record<string, unknown>;

const b1 = "https://example.com/python-guide";
const b2 = "https://example.com/rust-book";
const b3 = "https://example.com/cooking";
const b4 = "https://example.com/archived-python";

let token: string;

beforeEach(async () => {
  token = await apiToken(await setupTenant());
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
  await create({ url: b1, title: "Python guide", description: "Learn Python fast", tag_names: ["python", "tutorial"], unread: true });
  vi.setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
  await create({ url: b2, title: "The Rust Book", notes: "read chapter 3", tag_names: ["rust", "book"] });
  await create({ url: b3, title: "Cooking with Java", description: "coffee not code" });
  await create({ url: b4, title: "Old Python notes", tag_names: ["python"], is_archived: true });
});

async function create(fields: Json): Promise<void> {
  expect((await api(token).post("/api/bookmarks/?disable_scraping", fields)).status).toBe(201);
}

/** GETs the list at `path` with `q` and any other parameters, expecting 200. */
async function search(q: string, extra: Record<string, string> = {}, path = "/api/bookmarks/"): Promise<Json> {
  const response = await api(token).get(`${path}?${new URLSearchParams({ q, ...extra })}`);
  expect(response.status).toBe(200);
  return response.json<Json>();
}

const urls = (body: Json) => (body.results as Json[]).map((bookmark) => bookmark.url);

describe("Query grammar on the active list", () => {
  it.each<[string, string[]]>([
    ["python", [b1]],
    ["PYTHON", [b1]],
    ['"python guide"', [b1]],
    ["'learn python'", [b1]],
    ["guide fast", [b1]],
    ["guide and fast", [b1]],
    ["Guide AND Fast", [b1]],
    ["rust or java", [b3, b2]],
    ["python and tutorial", []],
    ["python and #tutorial", [b1]],
    ["#python", [b1]],
    ["#Python", [b1]],
    ["not python", [b3, b2]],
    ["NOT python", [b3, b2]],
    ["!unread", [b1]],
    ["!untagged", [b3]],
    ["!bogus", [b3, b2, b1]],
    ["chapter", [b2]],
    ["rust-book", [b2]],
    ["coffee (java or rust)", [b3]],
    ["(java or rust) and coffee", [b3]],
    ["not java and not rust", [b1]],
    ["not (java or rust)", [b1]],
    ["java or rust and chapter", [b3, b2]],
    ["(java or rust) and chapter", [b2]],
    ["#rust #book", [b2]],
    ["#rust or #tutorial", [b2, b1]],
    ["python not tutorial", [b1]],
    ["python not #tutorial", []],
    ["zzz", []],
  ])("%j selects the expected bookmarks newest first", async (q, expected) => {
    const body = await search(q);

    expect(urls(body)).toEqual(expected);
    expect(body.count).toBe(expected.length);
  });
});
