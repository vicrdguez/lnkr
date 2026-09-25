import { beforeEach, describe, expect, it } from "vitest";
import { api, apiToken, formPost, get, location, parseSse, select, setupInstance } from "./helpers";

type Json = Record<string, unknown>;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupInstance();
  token = await apiToken(cookie);
});

/** Saves `rules` as the Auto-tagging rules, expecting the redirect back to the settings page. */
async function saveRules(rules: string): Promise<void> {
  const response = await formPost("/settings/auto-tagging", { rules }, { cookie });
  expect(response.status).toBe(302);
  expect(location(response).pathname).toBe("/settings");
}

/** The content of the settings page's `rules` textarea, less the one leading newline a browser's parser drops. */
async function shownRules(): Promise<string> {
  const response = await get("/settings", { cookie });
  expect(response.status).toBe(200);
  const areas = await select(await response.text(), 'form[action="/settings/auto-tagging"] textarea[name="rules"]');
  expect(areas).toHaveLength(1);
  return areas[0].text.replace(/^\n/, "");
}

/** The `check` answer for `url`, expecting 200. */
async function check(url: string): Promise<Json> {
  const response = await api(token).get(`/api/bookmarks/check/?url=${encodeURIComponent(url)}`);
  expect(response.status).toBe(200);
  return response.json<Json>();
}

const autoTagsOf = async (url: string) => (await check(url)).auto_tags;

/** Posts a bookmark through the API without going online, expecting 201, and returns its JSON. */
async function create(url: string, fields: Json = {}): Promise<Json> {
  const response = await api(token).post("/api/bookmarks/?disable_scraping", { url, ...fields });
  expect(response.status).toBe(201);
  return response.json<Json>();
}

describe("Auto-tagging rules on the settings page", () => {
  it("saves the rules and shows them back verbatim", async () => {
    const rules = "github.com code\n# comment\nexample.com/docs docs reference";

    await saveRules(rules);

    expect(await shownRules()).toBe(rules);
  });

  it("keeps a leading blank line", async () => {
    await saveRules("\ngithub.com code");

    expect(await shownRules()).toBe("\ngithub.com code");
  });

  it("clears them when saved empty", async () => {
    await saveRules("github.com code");

    await saveRules("");

    expect(await shownRules()).toBe("");
    expect(await autoTagsOf("https://github.com/x")).toEqual([]);
  });

  it("starts empty", async () => {
    expect(await shownRules()).toBe("");
  });
});

describe("Tags added on creation", () => {
  beforeEach(() => saveRules("github.com code\ngithub.com/sissbruecker linkding"));

  it("adds the matching rules' tags to the submitted ones", async () => {
    const created = await create("https://github.com/sissbruecker/linkding", { tag_names: ["read-later"] });

    expect(created.tag_names).toEqual(["code", "linkding", "read-later"]);
  });

  it("never duplicates a submitted tag, regardless of case", async () => {
    const created = await create("https://github.com/a/b", { tag_names: ["Code"] });

    expect(created.tag_names).toEqual(["Code"]);
    const tags = (await (await api(token).get("/api/tags/")).json<Json>()).results as Json[];
    expect(tags.map((tag) => tag.name)).toEqual(["Code"]);
  });

  it("adds nothing when no rule matches", async () => {
    const created = await create("https://example.org/", { tag_names: ["x"] });

    expect(created.tag_names).toEqual(["x"]);
  });

  it("adds nothing when the API updates an existing URL", async () => {
    await saveRules("");
    await create("https://github.com/a/b", { tag_names: [] });
    await saveRules("github.com code\ngithub.com/sissbruecker linkding");

    const updated = await create("https://github.com/a/b", { title: "New title" });

    expect(updated).toMatchObject({ title: "New title", tag_names: [] });
  });

  it("applies the rules when the web form creates the Bookmark", async () => {
    const response = await formPost("/bookmarks/new", { url: "https://github.com/a/b", title: "B", tags: "mine" }, { cookie });
    expect(response.status).toBe(302);

    const { results } = await (await api(token).get("/api/bookmarks/")).json<{ results: Json[] }>();
    expect(results).toHaveLength(1);
    expect(results[0].tag_names).toEqual(["code", "mine"]);
  });

  it("adds nothing when the web form updates an existing URL", async () => {
    await saveRules("");
    await create("https://github.com/a/b", { title: "B" });
    await saveRules("github.com code");

    await formPost("/bookmarks/new", { url: "https://github.com/a/b", title: "B", tags: "mine" }, { cookie });

    const { results } = await (await api(token).get("/api/bookmarks/")).json<{ results: Json[] }>();
    expect(results[0].tag_names).toEqual(["mine"]);
  });

  it("never consults the rules when a Bookmark is edited", async () => {
    await saveRules("");
    const { id } = await create("https://example.com/", { title: "E" });
    await saveRules("github.com code\nexample.com code");

    await api(token).patch(`/api/bookmarks/${id}/`, { url: "https://github.com/e" });
    await api(token).put(`/api/bookmarks/${id}/`, { url: "https://github.com/f", tag_names: ["x"] });
    await formPost(`/bookmarks/${id}/edit`, { url: "https://github.com/g", title: "E", tags: "y" }, { cookie });

    const { results } = await (await api(token).get("/api/bookmarks/")).json<{ results: Json[] }>();
    expect(results[0]).toMatchObject({ url: "https://github.com/g", tag_names: ["y"] });
  });
});

describe("The form's URL hint", () => {
  const DATASTAR = { "datastar-request": "true" };
  const empty = { url: "", title: "", description: "", notes: "", tags: "", unread: false };

  /** The text of `#url-hint` as the URL check patches it for `signals`. */
  async function hint(signals: Json): Promise<string> {
    const response = await get(`/bookmarks/check?datastar=${encodeURIComponent(JSON.stringify({ ...empty, ...signals }))}`, {
      cookie,
      headers: DATASTAR,
    });
    expect(response.status).toBe(200);
    const patch = parseSse(await response.text()).find((event) => event.event === "datastar-patch-elements");
    const [found] = await select(patch?.data.elements ?? "", "#url-hint");
    return found.text;
  }

  it("lists the tags that will be added to a new URL", async () => {
    await saveRules("github.com code repo");

    expect(await hint({ url: "https://github.com/a/b" })).toContain("Will be tagged: code repo");
  });

  it("lists nothing when no rule matches", async () => {
    await saveRules("github.com code");

    expect(await hint({ url: "https://example.com/" })).toBe("");
  });

  it("lists nothing for a URL that is already bookmarked or on the edit form", async () => {
    await saveRules("");
    const { id } = await create("https://github.com/a/b");
    await saveRules("github.com code");

    expect(await hint({ url: "https://github.com/a/b" })).not.toContain("Will be tagged");
    expect(await hint({ id, url: "https://github.com/c" })).toBe("");
  });
});

describe("Check reports auto tags", () => {
  it("for an unbookmarked URL", async () => {
    await saveRules("github.com code");

    const body = await check("https://github.com/a/b");

    expect(body.bookmark).toBeNull();
    expect(body.auto_tags).toEqual(["code"]);
  });

  it("for a bookmarked URL", async () => {
    await saveRules("github.com code");
    const bookmark = await create("https://github.com/a/b");

    const body = await check("https://github.com/a/b");

    expect(body.bookmark).toEqual(bookmark);
    expect(body.auto_tags).toEqual(["code"]);
  });

  it("unique and in rule order", async () => {
    await saveRules("github.com code\ngithub.com/a code repo");

    expect(await autoTagsOf("https://github.com/a/b")).toEqual(["code", "repo"]);
  });

  it("unique regardless of case, keeping the first spelling", async () => {
    await saveRules("github.com Code\ngithub.com code repo");

    expect(await autoTagsOf("https://github.com/a/b")).toEqual(["Code", "repo"]);
  });
});

describe("Rule matching", () => {
  it.each([
    ["example.com", "https://example.com/", ["hit"]],
    ["example.com", "https://www.example.com/page", ["hit"]],
    ["example.com", "https://EXAMPLE.com/", ["hit"]],
    ["example.com", "https://notexample.com/", []],
    ["example.com", "https://example.com.evil.net/", []],
    ["example.com/docs", "https://example.com/docs/intro", ["hit"]],
    ["example.com/docs", "https://example.com/Docs/intro", []],
    ["example.com/docs", "https://example.com/blog", []],
    ["example.com?lang=en", "https://example.com/?lang=en&x=1", ["hit"]],
    ["example.com?lang=en", "https://example.com/?lang=de", []],
    ["example.com?lang", "https://example.com/?lang=de", ["hit"]],
    ["example.com?lang", "https://example.com/", []],
    ["example.com#section", "https://example.com/#section-2", ["hit"]],
    ["example.com#section", "https://example.com/#other", []],
    ["example.com/docs?v=2#intro", "https://example.com/docs/a?v=2&b=1#intro-x", ["hit"]],
  ])("pattern %s against %s", async (pattern, url, result) => {
    await saveRules(`${pattern} hit`);

    expect(await autoTagsOf(url)).toEqual(result);
  });

  it("ignores comments, blank lines and tagless lines", async () => {
    await saveRules("# only a comment\n\nexample.com\nexample.org hit");

    expect(await autoTagsOf("https://example.com/")).toEqual([]);
    expect(await autoTagsOf("https://example.org/")).toEqual(["hit"]);
  });

  it("ignores patterns that do not parse and reads lines a browser ends with CRLF", async () => {
    await saveRules("http://[bad example.com\r\n?x=1 query\r\nhttps://example.org hit\r\n");

    expect(await autoTagsOf("https://example.org/")).toEqual(["hit"]);
    expect(await shownRules()).toBe("http://[bad example.com\r\n?x=1 query\r\nhttps://example.org hit\r\n");
  });

  it("adds every tag of a rule with several", async () => {
    await saveRules("example.com one two three");

    expect((await create("https://example.com/")).tag_names).toEqual(["one", "three", "two"]);
  });
});
