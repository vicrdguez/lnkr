import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiToken, BASE, formPost, get, location, mockPage, select, setupTenant } from "./helpers";
import { network } from "./network";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

/** Creates a bookmark through the API without touching the network and returns its JSON. */
async function create(url: string, fields: Json = {}): Promise<Json> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields });
  expect(response.status).toBe(201);
  return response.json<Json>();
}

/** The HTML of `path` for the session, expecting `status`. */
async function page(path: string, status = 200): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(status);
  return response.text();
}

/** The value of each named form control: `value` for inputs, the content for textareas. */
async function fieldValues(html: string): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const input of await select(html, "main form input")) values[input.attrs.name] = input.attrs.value ?? "";
  for (const area of await select(html, "main form textarea")) values[area.attrs.name] = area.text;
  return values;
}

const signalsOf = async (html: string) => JSON.parse((await select(html, "main form"))[0].attrs["data-signals"]);

const DATASTAR = { "datastar-request": "true" };

/** Calls a Datastar GET action the way the client does: signals as JSON in `datastar`, plus the header. */
const action = (path: string, signals: Json, headers: Record<string, string> = DATASTAR) =>
  get(`${path}?datastar=${encodeURIComponent(JSON.stringify(signals))}`, { cookie, headers });

type SseEvent = { event: string; data: Record<string, string> };

/** The events of an SSE body: each block's `event:` name and its `data: <key> <value>` lines joined per key. */
function parseSse(text: string): SseEvent[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      const data: Record<string, string> = {};
      for (const line of rest) {
        const [, key, value] = line.match(/^data: (\S+) ?(.*)$/) ?? [];
        if (key) data[key] = key in data ? `${data[key]}\n${value}` : value;
      }
      return { event: first.replace("event: ", ""), data };
    });
}

/** The action's events, expecting an SSE response. */
async function events(path: string, signals: Json): Promise<SseEvent[]> {
  const response = await action(path, signals);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  return parseSse(await response.text());
}

/** The elements of the one `datastar-patch-elements` event. */
function patchedElements(found: SseEvent[]): string {
  const patches = found.filter((event) => event.event === "datastar-patch-elements");
  expect(patches).toHaveLength(1);
  return patches[0].data.elements;
}

/** The signals of the one `datastar-patch-signals` event, or undefined when none was sent. */
function patchedSignals(found: SseEvent[]): Json | undefined {
  const patches = found.filter((event) => event.event === "datastar-patch-signals");
  expect(patches.length).toBeLessThanOrEqual(1);
  return patches[0] && JSON.parse(patches[0].data.signals);
}

describe("New bookmark form", () => {
  it("renders empty", async () => {
    const html = await page("/bookmarks/new");

    const [form] = await select(html, "main form");
    expect(form.attrs.action).toBe("/bookmarks/new");
    expect(await fieldValues(html)).toEqual({ url: "", title: "", description: "", notes: "", tags: "", unread: "" });
    const [unread] = await select(html, 'form input[name="unread"]');
    expect(unread.attrs.type).toBe("checkbox");
    expect(unread.attrs.checked).toBeUndefined();
    expect(await select(html, 'input[name="auto_close"]')).toEqual([]);
    expect((await select(html, "script")).map((s) => s.attrs.src)).toContain("/static/datastar.js");
    expect((await get("/static/datastar.js")).status).toBe(200);
    expect(await signalsOf(html)).toEqual({ url: "", title: "", description: "", notes: "", tags: "", unread: false });
  });

  it("is prefilled from query parameters", async () => {
    const html = await page("/bookmarks/new?url=https://example.com/x&title=X&description=Desc&notes=N&tags=a+b&auto_close");

    const expected = { url: "https://example.com/x", title: "X", description: "Desc", notes: "N", tags: "a b" };
    expect(await fieldValues(html)).toMatchObject(expected);
    const [autoClose] = await select(html, 'form input[name="auto_close"]');
    expect(autoClose.attrs.type).toBe("hidden");
    expect(await signalsOf(html)).toEqual({ ...expected, unread: false });
  });
});

describe("Saving a new bookmark", () => {
  const listed = async () => (await api(token).get("/api/bookmarks/")).json<{ count: number; results: Json[] }>();

  it("creates the bookmark and redirects to the list", async () => {
    const fields = { url: "https://example.com/x", title: "X", description: "Desc", notes: "N", tags: "a b", unread: "on" };

    const response = await formPost("/bookmarks/new", fields, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const { count, results } = await listed();
    expect(count).toBe(1);
    expect(results[0]).toMatchObject({
      url: "https://example.com/x",
      title: "X",
      description: "Desc",
      notes: "N",
      tag_names: ["a", "b"],
      unread: true,
    });
  });

  it("ends on the close page with auto_close", async () => {
    const response = await formPost("/bookmarks/new", { url: "https://example.com/x", auto_close: "1" }, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks/close`);
    const html = await page("/bookmarks/close");
    expect(html).toContain("You can now close this window");
    expect(html).toContain("window.close()");
  });

  it("updates the bookmark that already has the URL", async () => {
    await create("https://example.com/x", { title: "Old", tag_names: ["old"] });

    const response = await formPost("/bookmarks/new", { url: "https://example.com/x", title: "New", tags: "new" }, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const { count, results } = await listed();
    expect(count).toBe(1);
    expect(results[0]).toMatchObject({ title: "New", tag_names: ["new"] });
  });

  it.each(["", "nope", "ftp://x.y/"])("refuses the URL %j", async (url) => {
    const response = await formPost("/bookmarks/new", { url, title: "T" }, { cookie });

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain("Enter a valid URL");
    expect(await fieldValues(html)).toMatchObject({ url, title: "T" });
    expect((await listed()).count).toBe(0);
  });
});

describe("URL check", () => {
  const empty = { url: "", title: "", description: "", notes: "", tags: "", unread: false };

  it("fills the form from the existing bookmark and shows the notice", async () => {
    const { id } = await create("https://example.com/x", {
      title: "X",
      description: "D",
      notes: "N",
      tag_names: ["a", "b"],
      unread: true,
    });

    const found = await events("/bookmarks/check", { ...empty, url: "https://example.com/x" });

    const [hint] = await select(patchedElements(found), "#url-hint");
    expect(hint.text).toContain("This URL is already bookmarked");
    const [link] = await select(patchedElements(found), "#url-hint a");
    expect(link.attrs.href).toBe(`/bookmarks/${id}/edit`);
    expect(patchedSignals(found)).toEqual({ title: "X", description: "D", notes: "N", tags: "a b", unread: true });
  });

  it("fills empty fields from the page for a new URL", async () => {
    mockPage("https://example.com/new", '<title>Page title</title><meta name="description" content="Page desc">');

    const found = await events("/bookmarks/check", { ...empty, url: "https://example.com/new", description: "Mine" });

    const [hint] = await select(patchedElements(found), "#url-hint");
    expect(hint.text).toBe("");
    expect(patchedSignals(found)).toEqual({ title: "Page title" });
  });

  it("patches nothing but the hint for an unreachable page", async () => {
    const found = await events("/bookmarks/check", { ...empty, url: "https://example.com/down" });

    const [hint] = await select(patchedElements(found), "#url-hint");
    expect(hint.text).toBe("");
    expect(patchedSignals(found)).toBeUndefined();
  });

  it("patches only an empty hint for an invalid URL without going online", async () => {
    let requests = 0;
    network.use(
      http.all("*", () => {
        requests++;
        return HttpResponse.error();
      }),
    );

    const found = await events("/bookmarks/check", { ...empty, url: "nope" });

    const [hint] = await select(patchedElements(found), "#url-hint");
    expect(hint.text).toBe("");
    expect(patchedSignals(found)).toBeUndefined();
    expect(requests).toBe(0);
  });

  it("needs the Datastar header", async () => {
    const response = await action("/bookmarks/check", { url: "https://example.com/" }, {});

    expect(response.status).toBe(400);
  });
});

describe("Tag suggestions", () => {
  const suggest = async (tags: string) => select(patchedElements(await events("/bookmarks/tags/suggest", { tags })), "#tag-suggestions button");
  const names = async (tags: string) => (await suggest(tags)).map((button) => button.text);

  beforeEach(async () => {
    for (const name of ["python", "pytest", "rust", "Pyramid"]) {
      expect((await api(token).post("/api/tags/", { name })).status).toBe(201);
    }
  });

  it("matches the last token regardless of case", async () => {
    expect(await names("rust py")).toEqual(["Pyramid", "pytest", "python"]);
  });

  it("excludes names already typed", async () => {
    expect(await names("python py")).toEqual(["Pyramid", "pytest"]);
    expect(await names("Python py")).toEqual(["Pyramid", "pytest"]);
  });

  it("suggests nothing for an empty last token", async () => {
    const [box] = await select(patchedElements(await events("/bookmarks/tags/suggest", { tags: "python " })), "#tag-suggestions");

    expect(box.text).toBe("");
    expect(await names("python ")).toEqual([]);
  });

  it("caps at ten", async () => {
    for (let n = 1; n <= 12; n++) await api(token).post("/api/tags/", { name: `t${String(n).padStart(2, "0")}` });

    expect(await names("t")).toHaveLength(10);
  });

  it("completes the token when picked", async () => {
    const buttons = await suggest("rust py");

    expect(buttons.map((button) => button.attrs["data-on:click"])).toEqual([
      "$tags = 'rust Pyramid '",
      "$tags = 'rust pytest '",
      "$tags = 'rust python '",
    ]);
  });
});

describe("Edit bookmark", () => {
  let id: unknown;
  const read = async () => (await api(token).get(`/api/bookmarks/${id}/`)).json<Json>();

  beforeEach(async () => {
    ({ id } = await create("https://example.com/x", { title: "X", notes: "N", tag_names: ["a", "b"], unread: true }));
    await create("https://example.com/y");
  });

  it("prefills the form", async () => {
    const html = await page(`/bookmarks/${id}/edit`);

    const [form] = await select(html, "main form");
    expect(form.attrs.action).toBe(`/bookmarks/${id}/edit`);
    expect(await fieldValues(html)).toMatchObject({ url: "https://example.com/x", title: "X", notes: "N", tags: "a b" });
    const [unread] = await select(html, 'main form input[name="unread"]');
    expect(unread.attrs.checked).toBeDefined();
    expect(await signalsOf(html)).toMatchObject({ url: "https://example.com/x", title: "X", notes: "N", tags: "a b", unread: true });
  });

  it("saves the changes", async () => {
    const before = (await read()).date_modified as string;
    vi.setSystemTime(Date.parse(before) + 60_000);
    const fields = { url: "https://example.com/x", title: "X2", description: "D2", notes: "", tags: "c" };

    const response = await formPost(`/bookmarks/${id}/edit`, fields, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/bookmarks`);
    const after = await read();
    expect(after).toMatchObject({ title: "X2", description: "D2", notes: "", tag_names: ["c"], unread: false });
    expect(after.date_modified as string > before).toBe(true);
  });

  it("refuses a URL another bookmark has", async () => {
    const response = await formPost(`/bookmarks/${id}/edit`, { url: "https://example.com/y", title: "X" }, { cookie });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("A bookmark with this URL already exists");
    expect((await read()).url).toBe("https://example.com/x");
  });

  it("answers 404 for an unknown bookmark", async () => {
    await page("/bookmarks/999/edit", 404);
  });
});

describe("Entry points", () => {
  /** The `href` of the first link whose text is `text`, or undefined when there is none. */
  const link = async (html: string, selector: string, text: string) =>
    (await select(html, selector)).find((a) => a.text === text)?.attrs.href;

  it("offers the bookmarklet on the settings page", async () => {
    const href = (await select(await page("/settings"), "a")).map((a) => a.attrs.href).find((h) => h?.startsWith("javascript:"));

    expect(href).toContain("https://lnkr.test/bookmarks/new?url=");
    expect(href).toContain("encodeURIComponent(location.href)");
    expect(href).toContain("document.title");
    expect(href).toContain("auto_close");
  });

  it("links to the form from the list", async () => {
    const { id } = await create("https://example.com/x");

    const html = await page("/bookmarks");

    expect(await link(html, "nav a", "Add bookmark")).toBe("/bookmarks/new");
    expect(await link(html, "#bookmark-list li a", "Edit")).toBe(`/bookmarks/${id}/edit`);
  });

  it("needs a session", async () => {
    const response = await get("/bookmarks/new");

    expect(response.status).toBe(302);
    expect(location(response).href).toBe(`${BASE}/login?next=%2Fbookmarks%2Fnew`);
  });
});
