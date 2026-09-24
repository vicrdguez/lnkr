import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, formPost, get, location, select, setupTenant } from "./helpers";

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

/** The Background's bookmark A. */
const bookmarkA = () =>
  create("https://example.com/a", { title: "A", description: "About A", notes: "note", tag_names: ["alpha", "beta"], unread: true });

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

/** What a browser posts for the untouched General form: every default, the three action boxes checked. */
const DEFAULT_FORM: Record<string, string> = {
  theme: "auto",
  bookmark_date_display: "relative",
  bookmark_description_display: "inline",
  bookmark_description_max_lines: "1",
  bookmark_link_target: "_blank",
  tag_search: "strict",
  tag_grouping: "alphabetical",
  items_per_page: "30",
  display_edit_bookmark_action: "on",
  display_archive_bookmark_action: "on",
  display_remove_bookmark_action: "on",
  custom_css: "",
};

/** Posts the General form with `changes` over the defaults; an undefined change leaves a checkbox out. */
async function saveGeneral(changes: Record<string, string | undefined>): Promise<Response> {
  const fields = { ...DEFAULT_FORM, ...changes };
  for (const [name, value] of Object.entries(fields)) if (value === undefined) delete fields[name];
  const response = await formPost("/settings/general", fields as Record<string, string>, { cookie });
  expect(response.status).toBe(302);
  return response;
}

/** The General form as `/settings` shows it: each select's selected value, each box's state, each text value. */
async function generalForm(): Promise<Record<string, string | boolean>> {
  const html = await page("/settings");
  const values: Record<string, string | boolean> = {};
  for (const name of ["theme", "bookmark_date_display", "bookmark_description_display", "bookmark_link_target", "tag_search", "tag_grouping"]) {
    const selected = await select(html, `select[name="${name}"] option[selected]`);
    expect(selected).toHaveLength(1);
    values[name] = selected[0].attrs.value;
  }
  for (const input of await select(html, 'form[action="/settings/general"] input')) {
    values[input.attrs.name] = input.attrs.type === "checkbox" ? "checked" in input.attrs : input.attrs.value;
  }
  const [css] = await select(html, 'textarea[name="custom_css"]');
  values.custom_css = css.text;
  return values;
}

const titles = async (html: string) => (await select(html, "#bookmark-list li a.title")).map((a) => a.text);

describe("General settings form", () => {
  it("shows the defaults", async () => {
    expect(await generalForm()).toEqual({
      theme: "auto",
      bookmark_date_display: "relative",
      bookmark_description_display: "inline",
      bookmark_description_max_lines: "1",
      bookmark_link_target: "_blank",
      display_url: false,
      tag_search: "strict",
      tag_grouping: "alphabetical",
      sticky_pagination: false,
      collapse_side_panel: false,
      items_per_page: "30",
      display_edit_bookmark_action: true,
      display_archive_bookmark_action: true,
      display_remove_bookmark_action: true,
      default_mark_unread: false,
      permanent_notes: false,
      custom_css: "",
    });
  });

  it("stores every field", async () => {
    const response = await saveGeneral({
      theme: "dark",
      bookmark_date_display: "absolute",
      bookmark_description_display: "separate",
      bookmark_description_max_lines: "3",
      bookmark_link_target: "_self",
      display_url: "on",
      tag_search: "lax",
      tag_grouping: "disabled",
      sticky_pagination: "on",
      collapse_side_panel: "on",
      items_per_page: "50",
      display_edit_bookmark_action: undefined,
      display_archive_bookmark_action: "on",
      display_remove_bookmark_action: undefined,
      default_mark_unread: "on",
      permanent_notes: "on",
      custom_css: "body{}",
    });

    expect(location(response).pathname).toBe("/settings");
    expect(await generalForm()).toEqual({
      theme: "dark",
      bookmark_date_display: "absolute",
      bookmark_description_display: "separate",
      bookmark_description_max_lines: "3",
      bookmark_link_target: "_self",
      display_url: true,
      tag_search: "lax",
      tag_grouping: "disabled",
      sticky_pagination: true,
      collapse_side_panel: true,
      items_per_page: "50",
      display_edit_bookmark_action: false,
      display_archive_bookmark_action: true,
      display_remove_bookmark_action: false,
      default_mark_unread: true,
      permanent_notes: true,
      custom_css: "body{}",
    });
  });

  it.each([
    ["theme", "blue", "auto"],
    ["items_per_page", "5", "30"],
    ["items_per_page", "abc", "30"],
    ["bookmark_description_max_lines", "0", "1"],
    ["tag_search", "fuzzy", "strict"],
  ])("falls back to the default for %s %s", async (field, value, shown) => {
    // A valid non-default first, so the fallback is observably the default and not the previous value.
    await saveGeneral({ theme: "dark", items_per_page: "50", bookmark_description_max_lines: "4", tag_search: "lax" });

    await saveGeneral({ [field]: value });

    expect((await generalForm())[field]).toBe(shown);
  });
});

describe("Theme", () => {
  it.each(["auto", "light", "dark"])("sets data-theme %s on the document", async (theme) => {
    await saveGeneral({ theme });

    const [html] = await select(await page("/bookmarks"), "html");

    expect(html.attrs["data-theme"]).toBe(theme);
  });

  it("styles each palette", async () => {
    const css = await (await get("/static/style.css")).text();

    expect(css).toMatch(/:root\s*{[^}]*--bg:/);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*{[^}]*--bg:/);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\[data-theme="auto"\]\s*{[^}]*--bg:/);
  });
});

describe("List display preferences", () => {
  it.each([
    ["relative", "3 days ago"],
    ["absolute", "2026-09-08"],
    ["hidden", undefined],
  ])("shows the date as %s", async (mode, text) => {
    vi.setSystemTime(new Date("2026-09-08T09:15:30.000Z"));
    await bookmarkA();
    vi.setSystemTime(new Date("2026-09-11T12:00:00.000Z"));
    await saveGeneral({ bookmark_date_display: mode });

    const dates = await select(await page("/bookmarks"), "#bookmark-list li a.date");

    expect(dates.map((date) => date.text)).toEqual(text ? [text] : []);
  });

  it("separates the description, clamped to max lines", async () => {
    await bookmarkA();
    await saveGeneral({ bookmark_description_display: "separate", bookmark_description_max_lines: "3" });

    const html = await page("/bookmarks");

    const [list] = await select(html, "ul#bookmark-list");
    expect(list.attrs.class).toBe("description-separate");
    expect(list.attrs.style).toBe("--ld-bookmark-description-max-lines: 3");
    expect(await select(html, "#bookmark-list .content")).toEqual([]);
    expect((await select(html, "#bookmark-list .description")).map((e) => e.text)).toEqual(["About A"]);
    expect((await select(html, "#bookmark-list .tags")).map((e) => e.text)).toEqual(["#alpha#beta"]);
    expect(await select(html, "#bookmark-list .description .tags")).toEqual([]);
  });

  it("shows the description inline with the tags", async () => {
    await bookmarkA();
    await saveGeneral({ bookmark_description_display: "inline" });

    const html = await page("/bookmarks");

    const [list] = await select(html, "ul#bookmark-list");
    expect(list.attrs.class).toBe("description-inline");
    expect((await select(html, "#bookmark-list .content .description")).map((e) => e.text)).toEqual(["About A"]);
    expect(await select(html, "#bookmark-list .content .tags")).toHaveLength(1);
  });

  it.each(["_blank", "_self"])("opens titles in %s", async (target) => {
    await bookmarkA();
    await saveGeneral({ bookmark_link_target: target });

    const [title] = await select(await page("/bookmarks"), "#bookmark-list a.title");

    expect(title.attrs.target).toBe(target);
  });

  it("shows the URL under the title only when display_url is on", async () => {
    await bookmarkA();
    await saveGeneral({ display_url: "on" });
    expect((await select(await page("/bookmarks"), "#bookmark-list li .url")).map((e) => e.text)).toEqual(["https://example.com/a"]);

    await saveGeneral({});
    expect(await select(await page("/bookmarks"), "#bookmark-list li .url")).toEqual([]);
  });

  /** Which of Edit, Archive and Delete the item offers. */
  async function controls(html: string): Promise<string[]> {
    const edit = (await select(html, "#bookmark-list li a.edit")).map((a) => a.text.trim());
    const buttons = (await select(html, "#bookmark-list li .actions button")).map((b) => b.text.trim());
    return [...edit, ...buttons].filter((name) => ["Edit", "Archive", "Delete"].includes(name));
  }

  it.each([
    ["display_edit_bookmark_action", ["Archive", "Delete"]],
    ["display_archive_bookmark_action", ["Edit", "Delete"]],
    ["display_remove_bookmark_action", ["Edit", "Archive"]],
  ])("hides a control when %s is off", async (flag, rest) => {
    await bookmarkA();
    await saveGeneral({ [flag]: undefined });

    expect(await controls(await page("/bookmarks"))).toEqual(rest);
  });

  it("opens notes when permanent_notes is on", async () => {
    await bookmarkA();
    await saveGeneral({ permanent_notes: "on" });
    expect((await select(await page("/bookmarks"), "#bookmark-list details"))[0].attrs).toHaveProperty("open");

    await saveGeneral({});
    expect((await select(await page("/bookmarks"), "#bookmark-list details"))[0].attrs).not.toHaveProperty("open");
  });

  it("marks the page for sticky pagination and a collapsed side panel", async () => {
    await saveGeneral({ sticky_pagination: "on", collapse_side_panel: "on" });

    const [body] = await select(await page("/bookmarks"), "body");

    expect(body.attrs.class.split(" ").sort()).toEqual(["side-panel-collapsed", "sticky-pagination"]);
  });
});

describe("Search behaviour preferences", () => {
  it("matches a bare term against tag names with lax tag search", async () => {
    await bookmarkA();
    await create("https://example.com/b", { title: "B", tag_names: ["alphabet"] });
    await saveGeneral({ tag_search: "lax" });

    expect(await titles(await page("/bookmarks?q=alpha"))).toEqual(["A"]);
    expect(await titles(await page("/bookmarks?q=ALPHA"))).toEqual(["A"]);
    expect(((await (await api(token).get("/api/bookmarks/?q=alpha")).json()) as Json).count).toBe(1);
  });

  it("does not match tag names with strict tag search", async () => {
    await bookmarkA();

    expect(await titles(await page("/bookmarks?q=alpha"))).toEqual([]);
    expect(((await (await api(token).get("/api/bookmarks/?q=alpha")).json()) as Json).count).toBe(0);
  });

  /** The sidebar's headings and tag names in document order. */
  async function sidebar(): Promise<string[]> {
    return (await select(await page("/bookmarks"), "#sidebar h4, #sidebar li a")).map((e) => e.text);
  }

  it("groups tags by first letter", async () => {
    await create("https://example.com/1", { tag_names: ["alpha", "beta"] });
    await create("https://example.com/2", { tag_names: ["apple", "2do"] });

    expect(await sidebar()).toEqual(["#", "2do", "A", "alpha", "apple", "B", "beta"]);
  });

  it("lists tags flat with grouping disabled", async () => {
    await create("https://example.com/1", { tag_names: ["alpha", "apple", "beta"] });
    await saveGeneral({ tag_grouping: "disabled" });

    expect(await sidebar()).toEqual(["alpha", "apple", "beta"]);
  });

  it("pages both lists by items_per_page", async () => {
    for (let i = 0; i < 12; i++) await create(`https://example.com/active/${i}`);
    for (let i = 0; i < 12; i++) await create(`https://example.com/archived/${i}`, { is_archived: true });
    await saveGeneral({ items_per_page: "10" });

    const active = await page("/bookmarks");
    expect(await titles(active)).toHaveLength(10);
    expect(active).toContain("Page 1 of 2");
    expect(await titles(await page("/bookmarks/archived"))).toHaveLength(10);
  });
});

describe("Form and notes defaults", () => {
  it("checks Unread on the new-bookmark form only", async () => {
    await saveGeneral({ default_mark_unread: "on" });

    const [box] = await select(await page("/bookmarks/new"), 'input[name="unread"]');
    expect(box.attrs).toHaveProperty("checked");

    const response = await api(token).post("/api/bookmarks/?disable_scraping", { url: "https://example.com/n" });
    expect(response.status).toBe(201);
    expect(((await response.json()) as Json).unread).toBe(false);
  });

  it("leaves Unread unchecked by default", async () => {
    const [box] = await select(await page("/bookmarks/new"), 'input[name="unread"]');

    expect(box.attrs).not.toHaveProperty("checked");
  });
});

describe("Custom CSS", () => {
  const cssLinks = async () =>
    (await select(await page("/bookmarks"), 'head link[rel="stylesheet"]'))
      .map((link) => link.attrs.href)
      .filter((href) => href.startsWith("/custom_css"));

  it("serves and links the CSS", async () => {
    await saveGeneral({ custom_css: "body { color: red }" });

    const [href] = await cssLinks();
    expect(href).toMatch(/^\/custom_css\?v=[0-9a-f]{8}$/);
    const response = await get("/custom_css", { cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("max-age=2592000");
    expect(await response.text()).toBe("body { color: red }");
  });

  it("changes the hash with the content", async () => {
    await saveGeneral({ custom_css: "a {}" });
    const [h1] = await cssLinks();

    await saveGeneral({ custom_css: "b {}" });
    const [h2] = await cssLinks();

    expect(h2).toMatch(/^\/custom_css\?v=[0-9a-f]{8}$/);
    expect(h2).not.toBe(h1);
  });

  it("links nothing for empty CSS", async () => {
    expect(await cssLinks()).toEqual([]);
    const response = await get("/custom_css", { cookie });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});

describe("Saved search preferences", () => {
  async function threeBookmarks() {
    await create("https://example.com/c", { title: "C", unread: true });
    await create("https://example.com/a", { title: "A", unread: true });
    await create("https://example.com/b", { title: "B" });
  }

  it("saves the current sort and filter as the list's defaults", async () => {
    await threeBookmarks();

    const response = await formPost("/bookmarks/search-preferences", { q: "", sort: "title_asc", unread: "yes" }, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/bookmarks");
    const html = await page("/bookmarks");
    expect(await titles(html)).toEqual(["A", "C"]);
    const [sort] = await select(html, 'form.search input[name="sort"]');
    const [unread] = await select(html, 'form.search input[name="unread"]');
    expect(sort.attrs.value).toBe("title_asc");
    expect(unread.attrs.value).toBe("yes");
    expect(await titles(await page("/bookmarks?sort=added_desc&unread="))).toEqual(["B", "A", "C"]);
  });

  it("offers Save in the search form", async () => {
    const [save] = await select(await page("/bookmarks"), "form.search button[formaction]");

    expect(save.attrs).toMatchObject({ formaction: "/bookmarks/search-preferences", formmethod: "post" });
  });

  it("lets the Unread link turn a saved Unread default off", async () => {
    await threeBookmarks();
    await formPost("/bookmarks/search-preferences", { sort: "title_asc", unread: "yes" }, { cookie });

    const href = (await select(await page("/bookmarks"), ".toolbar a")).find((a) => a.text === "Unread")?.attrs.href ?? "";

    expect(await titles(await page(href))).toEqual(["A", "B", "C"]);
  });

  it("reports them in the profile", async () => {
    await formPost("/bookmarks/search-preferences", { sort: "title_asc", unread: "yes" }, { cookie });

    const profile = (await (await api(token).get("/api/user/profile/")).json()) as Json;

    expect(profile.search_preferences).toEqual({ sort: "title_asc", shared: "off", unread: "yes" });
  });
});

describe("Profile", () => {
  it("reports the stored preferences", async () => {
    await saveGeneral({
      theme: "dark",
      bookmark_date_display: "absolute",
      bookmark_link_target: "_self",
      tag_search: "lax",
      display_url: "on",
      permanent_notes: "on",
    });

    const profile = (await (await api(token).get("/api/user/profile/")).json()) as Json;

    expect(profile).toMatchObject({
      theme: "dark",
      bookmark_date_display: "absolute",
      bookmark_link_target: "_self",
      tag_search: "lax",
      display_url: true,
      permanent_notes: true,
      web_archive_integration: "disabled",
      enable_sharing: false,
      enable_public_sharing: false,
    });
  });
});
