import { parse } from "hono/utils/cookie";
import { parseTenantKey } from "./auth/credential";
import { SESSION_COOKIE } from "./auth/session";

export { Directory } from "./directory";
export { Tenant } from "./tenant";

/**
 * The only place that decides which Tenant object serves a request (ADR 0001): the one named by the tenant key in the
 * first well-formed credential among the `Authorization: Token` header, the feed token path and the session cookie.
 * Null means the request carries none and the Directory serves it.
 */
export function tenantFor(request: Request, env: Env): DurableObjectId | null {
  const [scheme, token] = request.headers.get("authorization")?.trim().split(/\s+/) ?? [];
  const credentials = [
    scheme?.toLowerCase() === "token" ? token : undefined,
    new URL(request.url).pathname.match(/^\/feeds\/([^/]+)\//)?.[1],
    parse(request.headers.get("cookie") ?? "", SESSION_COOKIE)[SESSION_COOKIE],
  ];
  for (const credential of credentials) {
    const key = credential ? parseTenantKey(credential) : null;
    if (key) return env.TENANT.idFromName(key);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    // In production the platform serves public/ before the Worker runs; this keeps
    // assets reachable through the same entry point under the test harness.
    if (pathname.startsWith("/static/")) return env.ASSETS.fetch(request);
    const directory = env.DIRECTORY.get(env.DIRECTORY.idFromName("main"));
    // A login names its Tenant only by username, which the Directory resolves.
    if (request.method === "POST" && pathname === "/login") {
      const username = (await request.clone().formData().catch(() => null))?.get("username");
      const key = typeof username === "string" ? await directory.lookup(username) : null;
      return (key ? env.TENANT.get(env.TENANT.idFromName(key)) : directory).fetch(request);
    }
    const id = tenantFor(request, env);
    return id ? env.TENANT.get(id).fetch(request) : directory.fetch(request);
  },
} satisfies ExportedHandler<Env>;
