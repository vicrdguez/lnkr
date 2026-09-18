/** The Tenant's API token, or null when none has been created yet. */
export function currentToken(sql: SqlStorage): string | null {
  return sql.exec<{ key: string }>("SELECT key FROM api_tokens LIMIT 1").toArray()[0]?.key ?? null;
}

/** 20 random bytes as 40 lowercase hex characters, the shape of every token. */
const randomKey = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Stores and returns a fresh token. */
export function createToken(sql: SqlStorage, now: string): string {
  const key = randomKey();
  sql.exec("INSERT INTO api_tokens (key, created) VALUES (?, ?)", key, now);
  return key;
}

export function deleteTokens(sql: SqlStorage): void {
  sql.exec("DELETE FROM api_tokens");
}

export function hasToken(sql: SqlStorage, key: string): boolean {
  return sql.exec("SELECT 1 FROM api_tokens WHERE key = ?", key).toArray().length > 0;
}

/** The Tenant's feed token, created on first use. */
export function getOrCreateFeedToken(sql: SqlStorage, now: string): string {
  const existing = sql.exec<{ key: string }>("SELECT key FROM feed_tokens LIMIT 1").toArray()[0]?.key;
  if (existing) return existing;
  const key = randomKey();
  sql.exec("INSERT INTO feed_tokens (key, created) VALUES (?, ?)", key, now);
  return key;
}
