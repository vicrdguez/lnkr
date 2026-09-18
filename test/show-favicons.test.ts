import { beforeEach, describe, expect, it } from "vitest";
import { formPost, get, location, select, setupTenant } from "./helpers";

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
