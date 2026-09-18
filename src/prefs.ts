import { updatePrefs, type User } from "./db/users";

/** The Tenant's preferences, kept as JSON in `users.prefs`; a missing or malformed field takes its default. */
export type Prefs = { enable_favicons: boolean };

/** The Tenant's preferences; a document that does not parse counts as empty. */
export function readPrefs(user: User): Prefs {
  return { enable_favicons: stored(user.prefs).enable_favicons === true };
}

/** Stores `patch` over the user's current document, keeping fields this version does not know. */
export function writePrefs(sql: SqlStorage, user: User, patch: Partial<Prefs>): void {
  updatePrefs(sql, user.id, JSON.stringify({ ...stored(user.prefs), ...patch }));
}

function stored(json: string): Record<string, unknown> {
  try {
    const doc: unknown = JSON.parse(json);
    return doc && typeof doc === "object" ? (doc as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
