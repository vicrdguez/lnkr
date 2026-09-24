export { Tenant } from "./tenant";

/** The only place that decides which Tenant object serves a request (ADR 0001). */
export function tenantFor(_request: Request, env: Env): DurableObjectId {
  return env.TENANT.idFromName("main");
}

export default {
  fetch(request, env) {
    // In production the platform serves public/ before the Worker runs; this keeps
    // assets reachable through the same entry point under the test harness.
    if (new URL(request.url).pathname.startsWith("/static/")) return env.ASSETS.fetch(request);
    return env.TENANT.get(tenantFor(request, env)).fetch(request);
  },
} satisfies ExportedHandler<Env>;
