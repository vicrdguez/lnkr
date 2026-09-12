import { exports } from "cloudflare:workers";

export const BASE = "https://lnkr.test";
export const USERNAME = "vic";
export const PASSWORD = "correct horse battery";

type Options = { cookie?: string; origin?: string; base?: string };

export function get(path: string, cookie?: string, base = BASE): Promise<Response> {
  return exports.default.fetch(new URL(path, base), {
    headers: cookie ? { cookie: `sessionid=${cookie}` } : {},
    redirect: "manual",
  });
}

export function formPost(
  path: string,
  fields: Record<string, string>,
  { cookie, origin, base = BASE }: Options = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    origin: origin ?? base,
  };
  if (cookie) headers.cookie = `sessionid=${cookie}`;
  return exports.default.fetch(new URL(path, base), {
    method: "POST",
    headers,
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  });
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

/** The `sessionid` value from Set-Cookie, or undefined when none was sent. */
export function cookieOf(response: Response): string | undefined {
  return setCookieOf(response)?.split(";")[0].slice("sessionid=".length) || undefined;
}

export function location(response: Response): URL {
  return new URL(response.headers.get("location") ?? "", BASE);
}
