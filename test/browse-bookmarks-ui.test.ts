import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, BASE, get, location, select, setupTenant } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network. */
async function create(url: string, fields: Json = {}): Promise<void> {
  expect((await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields })).status).toBe(201);
}

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

const titles = async (html: string) => (await select(html, "#bookmark-list li a.title")).map((a) => a.text);

/** The `href` of the first link whose text is `text`, or undefined when there is none. */
const link = async (html: string, text: string) => (await select(html, "a")).find((a) => a.text === text)?.attrs.href;

describe("Bookmark list page", () => {
  async function threeBookmarks() {
    await create("https://example.com/1", { title: "One" });
    await create("https://example.com/2", { title: "Two" });
    await create("https://example.com/3", { title: "Three", is_archived: true });
  }

  it("renders active bookmarks newest first", async () => {
    await threeBookmarks();

    expect(await titles(await page("/bookmarks"))).toEqual(["Two", "One"]);
  });

  it("lists only archived bookmarks on the archive page", async () => {
    await threeBookmarks();

    expect(await titles(await page("/bookmarks/archived"))).toEqual(["Three"]);
  });

  it("shows an item's fields", async () => {
    await create("https://example.com/a", {
      title: "A",
      description: "About A",
      tag_names: ["alpha", "beta"],
      notes: "line one\nline two",
      unread: true,
    });

    const html = await page("/bookmarks");

    const [item] = await select(html, "#bookmark-list li");
    expect(item.attrs.class?.split(" ")).toContain("unread");
    expect(item.text).toContain("About A");
    const [title] = await select(html, "#bookmark-list li a.title");
    expect(title.text).toBe("A");
    expect(title.attrs).toMatchObject({ href: "https://example.com/a", target: "_blank" });
    const tags = await select(html, "#bookmark-list li a.tag");
    expect(tags.map((tag) => [tag.text, tag.attrs.href])).toEqual([
      ["#alpha", "/bookmarks?q=%23alpha"],
      ["#beta", "/bookmarks?q=%23beta"],
    ]);
    const [notes] = await select(html, "#bookmark-list li details");
    expect(notes.text).toContain("line one\nline two");
  });

  it("falls back to the URL when the title is empty", async () => {
    await create("https://example.com/untitled", { title: "" });

    expect(await titles(await page("/bookmarks"))).toEqual(["https://example.com/untitled"]);
  });

  it("escapes content", async () => {
    await create("https://example.com/x", {
      title: "<script>alert(1)</script>",
      notes: "<b>bold</b>",
      description: "<i>desc</i>",
      tag_names: ["<em>tag</em>"],
    });

    const html = await page("/bookmarks");

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;desc&lt;/i&gt;");
    expect(html).toContain("#&lt;em&gt;tag&lt;/em&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<i>desc</i>");
  });

  it("links the date to the Web Archive", async () => {
    vi.setSystemTime(new Date("2026-09-08T09:15:30.000Z"));
    await create("https://example.com/old");
    vi.setSystemTime(new Date("2026-09-11T12:00:00.000Z"));

    const [date] = await select(await page("/bookmarks"), "#bookmark-list li a.date");

    expect(date.text).toBe("3 days ago");
    expect(date.attrs).toMatchObject({
      href: "https://web.archive.org/web/20260908091530/https://example.com/old",
      title: "2026-09-08 09:15",
    });
  });

  it("shows empty states", async () => {
    expect(await page("/bookmarks")).toContain("No bookmarks yet");

    await create("https://example.com/1", { title: "One" });

    expect(await page("/bookmarks?q=zzz")).toContain("No bookmarks found");
  });
});

describe("Search, sort and filter", () => {
  beforeEach(async () => {
    await create("https://example.com/banana", { title: "Banana" });
    await create("https://example.com/apple", { title: "apple", unread: true });
    await create("https://example.com/cherry", { title: "Cherry" });
  });

  it("filters with q and keeps its value", async () => {
    const html = await page("/bookmarks?q=an");

    expect(await titles(html)).toEqual(["Banana"]);
    const [input] = await select(html, 'form.search input[name="q"]');
    expect(input.attrs.value).toBe("an");
  });

  it.each<[string, string[]]>([
    ["added_desc", ["Cherry", "apple", "Banana"]],
    ["added_asc", ["Banana", "apple", "Cherry"]],
    ["title_asc", ["apple", "Banana", "Cherry"]],
    ["title_desc", ["Cherry", "Banana", "apple"]],
    ["bogus", ["Cherry", "apple", "Banana"]],
  ])("sort=%s orders the list", async (sort, order) => {
    expect(await titles(await page(`/bookmarks?sort=${sort}`))).toEqual(order);
  });

  it("keeps only unread bookmarks with unread=yes", async () => {
    expect(await titles(await page("/bookmarks?unread=yes"))).toEqual(["apple"]);
  });

  it("keeps sort and unread in the search form", async () => {
    const hidden = await select(await page("/bookmarks?sort=title_asc&unread=yes"), 'form.search input[type="hidden"]');

    expect(hidden.map((input) => [input.attrs.name, input.attrs.value])).toEqual([
      ["sort", "title_asc"],
      ["unread", "yes"],
    ]);
  });
});

describe("Pagination", () => {
  beforeEach(async () => {
    for (let n = 1; n <= 31; n++) await create(`https://example.com/b${n}`, { title: `B${String(n).padStart(2, "0")}` });
  });

  it("shows thirty on the first page and links to the next", async () => {
    const html = await page("/bookmarks");

    const found = await titles(html);
    expect(found).toHaveLength(30);
    expect(found[0]).toBe("B31");
    expect(found[29]).toBe("B02");
    expect(await link(html, "Next")).toBe("/bookmarks?page=2");
    expect(await link(html, "Previous")).toBeUndefined();
    expect(html).toContain("Page 1 of 2");
  });

  it("shows the rest on the second page and links back", async () => {
    const html = await page("/bookmarks?page=2");

    expect(await titles(html)).toEqual(["B01"]);
    expect(await link(html, "Previous")).toBe("/bookmarks?page=1");
    expect(await link(html, "Next")).toBeUndefined();
  });

  it("keeps the query in page links", async () => {
    expect(await link(await page("/bookmarks?q=B&sort=added_asc"), "Next")).toBe("/bookmarks?q=B&sort=added_asc&page=2");
  });

  it("shows the last page when the page is out of range", async () => {
    const html = await page("/bookmarks?page=9");

    expect(await titles(html)).toEqual(["B01"]);
    expect(html).toContain("Page 2 of 2");
  });
});

describe("Tag sidebar", () => {
  const sidebar = async (html: string) => (await select(html, "#sidebar li")).map((li) => li.text);

  beforeEach(async () => {
    await create("https://example.com/1", { tag_names: ["python", "web"] });
    await create("https://example.com/2", { tag_names: ["python"] });
    await create("https://example.com/3", { tag_names: ["rust"] });
  });

  it("lists the tags of the whole result with counts", async () => {
    expect(await sidebar(await page("/bookmarks"))).toEqual(["python 2", "rust 1", "web 1"]);
  });

  it("follows the filter", async () => {
    expect(await sidebar(await page("/bookmarks?q=%23python"))).toEqual(["python 2", "web 1"]);
  });

  it("adds the tag to the query", async () => {
    const rust = (await select(await page("/bookmarks?q=example"), "#sidebar li a")).find((a) => a.text === "rust");

    expect(rust?.attrs.href).toBe("/bookmarks?q=example+%23rust");
  });

  it("removes a selected tag", async () => {
    const [selected] = await select(await page("/bookmarks?q=example+%23python"), "#sidebar li.selected a");

    expect(selected.text).toBe("python");
    expect(selected.attrs.href).toBe("/bookmarks?q=example");
  });

  it("counts across all pages", async () => {
    for (let n = 1; n <= 35; n++) await create(`https://example.com/many${n}`, { tag_names: ["many"] });

    expect(await sidebar(await page("/bookmarks"))).toContain("many 35");
  });
});

describe("Navigation and access", () => {
  it("redirects root to the list", async () => {
    const response = await get("/", { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
  });

  it("needs a session on the list pages", async () => {
    const response = await get("/bookmarks/archived?q=x");

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/login?next=%2Fbookmarks%2Farchived%3Fq%3Dx`);
  });

  it("marks the current section in the nav", async () => {
    const navClass = async (html: string, text: string) =>
      (await select(html, "nav a")).find((a) => a.text === text)?.attrs.class;

    const list = await page("/bookmarks");
    expect(await navClass(list, "Bookmarks")).toBe("active");
    expect(await navClass(list, "Archived")).toBeUndefined();

    expect(await navClass(await page("/bookmarks/archived"), "Archived")).toBe("active");
  });
});
