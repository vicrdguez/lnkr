import { exports } from "cloudflare:workers";
import { decodeHTML, decodeHTMLAttribute } from "entities/decode";
import { http, HttpResponse } from "msw";
import { network } from "./network";

export const BASE = "https://lnkr.test";
export const USERNAME = "vic";
export const PASSWORD = "correct horse battery";

/** `cookie` is a `sessionid` value; `origin` defaults to `base`, which defaults to `BASE`; `headers` are added as given. */
export type Options = { cookie?: string; origin?: string; base?: string; headers?: Record<string, string> };

export function get(path: string, options: Options = {}): Promise<Response> {
  return request(path, {}, options);
}

export function formPost(path: string, fields: Record<string, string>, options: Options = {}): Promise<Response> {
  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    origin: options.origin ?? options.base ?? BASE,
  };
  return request(path, { method: "POST", headers, body: new URLSearchParams(fields).toString() }, options);
}

/** A JSON POST as Datastar sends one: `application/json` with `body` serialised. */
export function jsonPost(path: string, body: unknown, options: Options = {}): Promise<Response> {
  const headers = { "content-type": "application/json" };
  return request(path, { method: "POST", headers, body: JSON.stringify(body) }, options);
}

export function login(username: string, password: string, options?: Options): Promise<Response> {
  return formPost("/login", { username, password }, options);
}

/** Creates the Tenant's user through /setup and returns its session cookie. */
export async function setupTenant(username = USERNAME, password = PASSWORD): Promise<string> {
  const response = await formPost("/setup", { username, password });
  const cookie = cookieOf(response);
  if (!cookie) throw new Error(`setup failed: ${response.status}`);
  return cookie;
}

/** The raw `sessionid` Set-Cookie line, or undefined when none was sent. */
export function setCookieOf(response: Response): string | undefined {
  return response.headers.getSetCookie().find((line) => line.startsWith("sessionid="));
}

/** Lower-cased attributes of the `sessionid` Set-Cookie line, e.g. `["max-age=0", "path=/"]`. */
export function cookieAttributes(response: Response): string[] {
  return (setCookieOf(response) ?? "")
    .split(";")
    .slice(1)
    .map((attribute) => attribute.trim().toLowerCase());
}

/** The `sessionid` value from Set-Cookie, or undefined when none was sent. */
export function cookieOf(response: Response): string | undefined {
  return setCookieOf(response)?.split(";")[0].slice("sessionid=".length) || undefined;
}

export function location(response: Response): URL {
  return new URL(response.headers.get("location") ?? "", BASE);
}

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  { cookie, base = BASE, headers: extra }: Options,
): Promise<Response> {
  const headers = { ...init.headers, ...extra };
  if (cookie) headers.cookie = `sessionid=${cookie}`;
  return exports.default.fetch(new URL(path, base), { ...init, headers, redirect: "manual" });
}

/** The API token shown on `/settings` for the session `cookie`. */
export async function apiToken(cookie: string): Promise<string> {
  const html = await (await get("/settings", { cookie })).text();
  const token = html.match(/<code id="api-token">([^<]*)<\/code>/)?.[1];
  if (!token) throw new Error("no api token on /settings");
  return token;
}

/** A small JSON client for `/api/` sending `Authorization: Token <token>` when one is given. */
export function api(token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Token ${token}`;
  const send = (method: string) => (path: string, body?: unknown) =>
    request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, {});
  return { get: send("GET"), post: send("POST"), put: send("PUT"), patch: send("PATCH"), del: send("DELETE") };
}

/** Serves `html` as `text/html` at `url` for the rest of the test. */
export function mockPage(url: string, html: string): void {
  network.use(http.get(url, () => HttpResponse.html(html)));
}

export type SseEvent = { event: string; data: Record<string, string> };

/** The events of an SSE body: each block's `event:` name and its `data: <key> <value>` lines joined per key. */
export function parseSse(text: string): SseEvent[] {
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

export type Found = { attrs: Record<string, string>; text: string };

/**
 * Every element of `html` matching `selector`, in document order, with its attributes and the text of its whole
 * subtree, both decoded. Matches of the same selector must not nest: an inner match would take the outer one's text.
 */
export async function select(html: string, selector: string): Promise<Found[]> {
  const found: Found[] = [];
  await new HTMLRewriter()
    .on(selector, {
      element(element) {
        const attrs = [...element.attributes].map(([name, value]) => [name, decodeHTMLAttribute(value)]);
        found.push({ attrs: Object.fromEntries(attrs), text: "" });
      },
      text(chunk) {
        found[found.length - 1].text += chunk.text;
      },
    })
    .transform(new Response(html))
    .text();
  // Character references can be split across chunks, so the text is decoded once it is whole.
  return found.map((element) => ({ ...element, text: decodeHTML(element.text) }));
}
