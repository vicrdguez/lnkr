/** `main`, the legacy Tenant, or 32 lowercase hex characters. */
export function isTenantKey(s: string): boolean {
  return s === "main" || /^[0-9a-f]{32}$/.test(s);
}

/** A fresh random tenant key: 16 bytes as 32 lowercase hex characters. */
export function newTenantKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The tenant key a credential names: `main` when it has no dot, null when its prefix is not a tenant key. */
export function parseTenantKey(value: string): string | null {
  const dot = value.indexOf(".");
  if (dot === -1) return "main";
  const key = value.slice(0, dot);
  return isTenantKey(key) ? key : null;
}

/** `<key>.<value>`, the form every credential a Tenant issues takes. */
export function formatCredential(key: string, value: string): string {
  return `${key}.${value}`;
}

/** The credential without its tenant key prefix, as storage holds it; a bare value is returned as it is. */
export function bareCredential(value: string): string {
  return value.slice(value.indexOf(".") + 1);
}
