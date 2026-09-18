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

/** The `all` and `unread` feed URLs on the settings page. */
async function feedUrls(html: string): Promise<[string, string]> {
  const [all] = await select(html, "#feed-all");
  const [unread] = await select(html, "#feed-unread");
  return [all.attrs.href, unread.attrs.href];
}

describe("Feed token", () => {
  it("is shown as two feed URLs", async () => {
    const [all, unread] = await feedUrls(await page("/settings"));

    expect(all).toMatch(new RegExp(`^${BASE}/feeds/[0-9a-f]{40}/all$`));
    expect(unread).toBe(all.replace(/all$/, "unread"));
  });

  it("is stable across views", async () => {
    const first = await feedUrls(await page("/settings"));

    expect(await feedUrls(await page("/settings"))).toEqual(first);
  });
});
