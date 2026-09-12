import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import pkg from "../package.json";
import { api, apiToken, formPost, get, location, mockPage, setupTenant } from "./helpers";
import { network } from "./network";

type Json = Record<string, unknown>;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let cookie: string;
let token: string;

beforeEach(async () => {
  cookie = await setupTenant();
  token = await apiToken(cookie);
});

describe("API token on the settings page", () => {
  it("is created on first view", async () => {
    expect(token).toMatch(/^[0-9a-f]{40}$/);
    expect((await api(token).get("/api/user/profile/")).status).toBe(200);
  });

  it("is replaced by Regenerate", async () => {
    const response = await formPost("/settings/token/regenerate", {}, { cookie });

    expect(response.status).toBe(302);
    expect(location(response).pathname).toBe("/settings");
    const replacement = await apiToken(cookie);
    expect(replacement).toMatch(/^[0-9a-f]{40}$/);
    expect(replacement).not.toBe(token);
    expect((await api(replacement).get("/api/user/profile/")).status).toBe(200);
    expect((await api(token).get("/api/user/profile/")).status).toBe(401);
  });
});

describe("API authentication", () => {
  it("refuses a missing token", async () => {
    const response = await api().get("/api/bookmarks/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Authentication credentials were not provided." });
  });

  it("refuses an unknown token", async () => {
    const response = await api("0".repeat(40)).get("/api/bookmarks/");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Invalid token." });
  });

  it("ignores session cookies", async () => {
    const response = await get("/api/bookmarks/", { cookie });

    expect(response.status).toBe(401);
  });
});

describe("User profile", () => {
  it("answers linkding's fields", async () => {
    const response = await api(token).get("/api/user/profile/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      theme: "auto",
      bookmark_date_display: "relative",
      bookmark_link_target: "_blank",
      web_archive_integration: "disabled",
      tag_search: "strict",
      enable_sharing: false,
      enable_public_sharing: false,
      enable_favicons: false,
      display_url: false,
      permanent_notes: false,
      search_preferences: { sort: "added_desc", shared: "off", unread: "off" },
      version: pkg.version,
    });
  });
});

describe("Create bookmarks", () => {
  it("creates with every field", async () => {
    const response = await api(token).post("/api/bookmarks/", {
      url: "https://example.com/a",
      title: "A",
      description: "About A",
      notes: "n",
      is_archived: false,
      unread: true,
      shared: false,
      tag_names: ["Alpha", "beta"],
    });

    expect(response.status).toBe(201);
    const body = await response.json<Json>();
    expect(Object.keys(body)).toEqual([
      "id",
      "url",
      "title",
      "description",
      "notes",
      "web_archive_snapshot_url",
      "favicon_url",
      "preview_image_url",
      "is_archived",
      "unread",
      "shared",
      "tag_names",
      "date_added",
      "date_modified",
    ]);
    expect(body).toMatchObject({
      url: "https://example.com/a",
      title: "A",
      description: "About A",
      notes: "n",
      web_archive_snapshot_url: "",
      favicon_url: null,
      preview_image_url: null,
      is_archived: false,
      unread: true,
      shared: false,
      tag_names: ["Alpha", "beta"],
    });
    expect(body.date_added).toMatch(ISO_UTC);
    expect(body.date_modified).toMatch(ISO_UTC);
    const tags = await (await api(token).get("/api/tags/")).json<{ results: { name: string }[] }>();
    expect(tags.results.map((tag) => tag.name)).toEqual(["Alpha", "beta"]);
  });

  it("trims and deduplicates tag names regardless of case", async () => {
    const response = await api(token).post("/api/bookmarks/", {
      url: "https://example.com/a",
      tag_names: [" go ", "Go", "rust"],
    });

    expect(response.status).toBe(201);
    expect((await response.json<Json>()).tag_names).toEqual(["go", "rust"]);
    const tags = await (await api(token).get("/api/tags/")).json<{ count: number }>();
    expect(tags.count).toBe(2);
  });

  it("updates the bookmark with an existing url instead of duplicating it", async () => {
    const first = await (await api(token).post("/api/bookmarks/", { url: "https://example.com/a", title: "A" })).json<Json>();

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/a", title: "A2" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: first.id, title: "A2" });
    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(1);
  });

  it("fills an empty title and description from the page", async () => {
    mockPage("https://example.com/p", '<title>Page P</title><meta name="description" content="Desc P">');

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/p" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "Page P", description: "Desc P" });
  });

  it("keeps provided fields over the page's", async () => {
    mockPage("https://example.com/p", "<title>Page P</title>");

    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/p", title: "Mine" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "Mine" });
  });

  it("skips the page fetch with disable_scraping", async () => {
    let requests = 0;
    network.use(
      http.all("*", () => {
        requests++;
        return HttpResponse.error();
      }),
    );

    const response = await api(token).post("/api/bookmarks/?disable_scraping", { url: "https://example.com/q" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "" });
    expect(requests).toBe(0);
  });

  it("leaves fields empty when the page is unreachable", async () => {
    const response = await api(token).post("/api/bookmarks/", { url: "https://example.com/down" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "", description: "" });
  });

  it.each(["", "not a url", "ftp://example.com", "javascript:alert(1)"])("refuses the invalid url %j", async (url) => {
    const response = await api(token).post("/api/bookmarks/", { url });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ url: ["Enter a valid URL."] });
    expect((await (await api(token).get("/api/bookmarks/")).json<Json>()).count).toBe(0);
  });
});
