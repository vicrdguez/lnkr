/** The Tenant's API token, or null when none has been created yet. */
export function currentToken(sql: SqlStorage): string | null {
  return sql.exec<{ key: string }>("SELECT key FROM api_tokens LIMIT 1").toArray()[0]?.key ?? null;
}

/** Stores and returns a fresh token: 20 random bytes as 40 lowercase hex characters. */
export function createToken(sql: SqlStorage, now: string): string {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  sql.exec("INSERT INTO api_tokens (key, created) VALUES (?, ?)", key, now);
  return key;
}

export function deleteTokens(sql: SqlStorage): void {
  sql.exec("DELETE FROM api_tokens");
}

export function hasToken(sql: SqlStorage, key: string): boolean {
  return sql.exec("SELECT 1 FROM api_tokens WHERE key = ?", key).toArray().length > 0;
}
