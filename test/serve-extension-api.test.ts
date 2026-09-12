import { beforeEach, describe, expect, it } from "vitest";
import pkg from "../package.json";
import { api, apiToken, formPost, get, location, setupTenant } from "./helpers";

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
