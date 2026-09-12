import { toUser, type User, type UserRow } from "./users";

export function createSession(sql: SqlStorage, userId: number, expiresAt: string): string {
  const id = base64url(crypto.getRandomValues(new Uint8Array(32)));
  sql.exec("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", id, userId, expiresAt);
  return id;
}

/** The session's user; an expired session is deleted on sight and treated as absent. */
export function findSessionUser(sql: SqlStorage, id: string, now: string): User | null {
  const row = sql
    .exec<UserRow & { expires_at: string }>(
      "SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
      id,
    )
    .toArray()[0];
  if (!row) return null;
  if (row.expires_at <= now) {
    deleteSession(sql, id);
    return null;
  }
  return toUser(row);
}

export function deleteSession(sql: SqlStorage, id: string): void {
  sql.exec("DELETE FROM sessions WHERE id = ?", id);
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
