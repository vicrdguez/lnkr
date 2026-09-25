import { beforeEach, describe, expect, it } from "vitest";
import { BASE, get, select, setupTenant } from "./helpers";

let cookie: string;

beforeEach(async () => {
  cookie = await setupTenant();
});

/** The HTML of `path` for the session, expecting 200. */
async function page(path: string): Promise<string> {
  const response = await get(path, { cookie });
  expect(response.status).toBe(200);
  return response.text();
}

/** The `value` of the new-bookmark form's `name` input for `query`. */
async function inputValue(query: string, name: string): Promise<string | undefined> {
  const [input] = await select(await page(`/bookmarks/new?${query}`), `main form input[name="${name}"]`);
  expect(input).toBeDefined();
  return input.attrs.value;
}

describe("Web app manifest", () => {
  it("is public and complete", async () => {
    const response = await get("/manifest.json");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/manifest+json");
    expect(response.headers.get("cache-control")).toBe("max-age=86400");
    const manifest = await response.json<Record<string, unknown>>();
    expect(manifest).toMatchObject({
      name: "lnkr",
      short_name: "lnkr",
      start_url: "/bookmarks",
      display: "standalone",
      theme_color: expect.any(String),
      background_color: expect.any(String),
      share_target: { action: "/bookmarks/new", method: "GET", params: { url: "url", title: "title", text: "text" } },
    });
    expect(manifest.icons).toContainEqual({ src: "/static/icon.svg", sizes: "any", type: "image/svg+xml" });
  });

  it("serves the icon", async () => {
    const response = await get("/static/icon.svg");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
  });
});

describe("OpenSearch", () => {
  it("serves the description publicly, templated on the Instance origin", async () => {
    const response = await get("/opensearch.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/opensearchdescription+xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("max-age=86400");
    const body = await response.text();
    expect(body).toContain("<ShortName>lnkr</ShortName>");
    expect(body).toContain(`<Url type="text/html" template="${BASE}/bookmarks?q={searchTerms}"/>`);
  });

  it("follows the origin the request arrived at", async () => {
    const body = await (await get("/opensearch.xml", { base: "https://other.test" })).text();

    expect(body).toContain('<Url type="text/html" template="https://other.test/bookmarks?q={searchTerms}"/>');
  });
});

describe("Head links", () => {
  it("advertise the manifest and search", async () => {
    const html = await page("/bookmarks");

    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
    expect(head).toContain('<link rel="manifest" href="/manifest.json"');
    expect(head).toContain(
      '<link rel="search" type="application/opensearchdescription+xml" title="lnkr" href="/opensearch.xml"',
    );
    expect(head).toContain('<meta name="theme-color"');
    expect(head).toContain('<link rel="apple-touch-icon" href="/static/icon.svg"');
  });
});

describe("Shared text as URL", () => {
  it("prefills the form from a URL in text", async () => {
    const query = "title=Shared&text=https://example.com/shared";

    expect(await inputValue(query, "url")).toBe("https://example.com/shared");
    expect(await inputValue(query, "title")).toBe("Shared");
    const [description] = await select(await page(`/bookmarks/new?${query}`), 'main form textarea[name="description"]');
    expect(description.text).toBe("");
  });

  it("ignores text that is not a URL", async () => {
    expect(await inputValue("text=just+words", "url") ?? "").toBe("");
  });

  it("lets an explicit url win over text", async () => {
    expect(await inputValue("url=https://example.com/a&text=https://example.com/b", "url")).toBe("https://example.com/a");
  });
});
