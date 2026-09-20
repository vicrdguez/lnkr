import { toBase64Url } from "../base64";
import { toUser, type User, type UserRow } from "./users";

export function createSession(sql: SqlStorage, userId: number, expiresAt: string): string {
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
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

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type Attempts = { failures: number; window_start: string };

/** True while `username` has reached the failure limit inside the current window. */
export function isLoginLocked(sql: SqlStorage, username: string, now: string): boolean {
  const row = loginAttempts(sql, username);
  return !!row && row.failures >= MAX_LOGIN_FAILURES && row.window_start > windowStart(now);
}

// DEBT(#23/W3): rows for never-seen usernames, and expired sessions whose cookie never returns, are never purged.
/** Counts one failure, opening a new window when none is current. */
export function recordLoginFailure(sql: SqlStorage, username: string, now: string): void {
  const row = loginAttempts(sql, username);
  if (row && row.window_start > windowStart(now)) {
    sql.exec("UPDATE login_attempts SET failures = failures + 1 WHERE username = ?", username);
  } else {
    sql.exec(
      "INSERT OR REPLACE INTO login_attempts (username, failures, window_start) VALUES (?, 1, ?)",
      username,
      now,
    );
  }
}

export function clearLoginFailures(sql: SqlStorage, username: string): void {
  sql.exec("DELETE FROM login_attempts WHERE username = ?", username);
}

function loginAttempts(sql: SqlStorage, username: string): Attempts | undefined {
  return sql
    .exec<Attempts>("SELECT failures, window_start FROM login_attempts WHERE username = ?", username)
    .toArray()[0];
}

/** Timestamp before which failures no longer count. */
function windowStart(now: string): string {
  return new Date(Date.parse(now) - LOGIN_WINDOW_MS).toISOString();
}
