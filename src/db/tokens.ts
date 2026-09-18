/** 20 random bytes as 40 lowercase hex characters, the shape of every token. */
const randomKey = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** An API token as the settings page lists it: never with its key. `id` is the row's rowid. */
// DEBT(#11/A2): a rowid is reused once the newest row is deleted, so a stale Revoke form can delete a token created since; give api_tokens an INTEGER PRIMARY KEY if that bites.
export type ApiToken = { id: number; name: string; created: string };

/** Every API token, oldest first. */
export function listApiTokens(sql: SqlStorage): ApiToken[] {
  return sql.exec<ApiToken>("SELECT rowid AS id, name, created FROM api_tokens ORDER BY created, rowid").toArray();
}

/** Stores a fresh token named `name` and returns it with its key, the only time the key leaves storage. */
export function createApiToken(sql: SqlStorage, name: string, now: string): { id: number; key: string } {
  const key = randomKey();
  const { id } = sql
    .exec<{ id: number }>("INSERT INTO api_tokens (key, name, created) VALUES (?, ?, ?) RETURNING rowid AS id", key, name, now)
    .one();
  return { id, key };
}

export function deleteApiToken(sql: SqlStorage, id: number): void {
  sql.exec("DELETE FROM api_tokens WHERE rowid = ?", id);
}

export function apiTokenExists(sql: SqlStorage, key: string): boolean {
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

export function feedTokenExists(sql: SqlStorage, key: string): boolean {
  return sql.exec("SELECT 1 FROM feed_tokens WHERE key = ?", key).toArray().length > 0;
}
