import { beforeEach, describe, expect, it } from "vitest";
import { api, apiToken, formPost, get, location, select, setupTenant } from "./helpers";

const PROVIDER = "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url={url}&size=32";

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network. */
async function create(url: string, fields: Record<string, unknown> = {}): Promise<void> {
  expect((await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields })).status).toBe(201);
}

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

/** The favicons checkbox on the settings page. */
async function toggle() {
  const [box] = await select(await page("/settings"), 'input[name="enable_favicons"]');
  expect(box).toBeDefined();
  return box;
}

/** Saves the toggle as a browser would: `on` sends the checked box, `off` sends the form without it. */
const save = (on: boolean) => formPost("/settings/favicons", on ? { enable_favicons: "on" } : {}, { cookie });

describe("Favicons toggle on the settings page", () => {
  it("is off by default", async () => {
    const box = await toggle();

    expect(box.attrs.type).toBe("checkbox");
    expect(box.attrs).not.toHaveProperty("checked");
  });

  it("turns on", async () => {
    const response = await save(true);

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/settings");
    expect((await toggle()).attrs).toHaveProperty("checked");
  });

  it("turns off", async () => {
    await save(true);

    await save(false);

    expect((await toggle()).attrs).not.toHaveProperty("checked");
  });
});

describe("Icons in the bookmark list", () => {
  const icons = async (path: string) => select(await page(path), "#bookmark-list li .favicon");

  beforeEach(() => create("https://example.com/some/page?x=1"));

  it("shows none when off", async () => {
    expect(await icons("/bookmarks")).toEqual([]);
  });

  it("points at the provider with the bookmark's origin only", async () => {
    await save(true);

    const [icon] = await select(await page("/bookmarks"), "#bookmark-list li img.favicon");

    expect(icon.attrs).toEqual({
      class: "favicon",
      src: PROVIDER.replace("{url}", "https%3A%2F%2Fexample.com"),
      alt: "",
      width: "16",
      height: "16",
      loading: "lazy",
    });
    expect(icon.attrs.src).not.toContain("some/page");
  });

  it("gives every item an icon", async () => {
    await save(true);
    await create("https://other.example/");

    expect(await icons("/bookmarks")).toHaveLength(2);
  });

  it("shows icons on the archived list too", async () => {
    await save(true);
    await create("https://archived.example/", { is_archived: true });

    expect(await icons("/bookmarks/archived")).toHaveLength(1);
  });
});
