/** Directory schema migrations in order; version equals array index plus one. */
export const directoryMigrations: string[] = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tenant_key TEXT NOT NULL UNIQUE,
    is_superuser INTEGER NOT NULL DEFAULT 0,
    date_joined TEXT NOT NULL
  );
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    landing_page TEXT NOT NULL DEFAULT 'login',
    guest_profile_user_id INTEGER
  );
  INSERT INTO settings (id) VALUES (1);`,
];

export type DirectoryUser = {
  id: number;
  username: string;
  tenantKey: string;
  isSuperuser: boolean;
  dateJoined: string;
};

type DirectoryUserRow = { id: number; username: string; tenant_key: string; is_superuser: number; date_joined: string };

const toDirectoryUser = (row: DirectoryUserRow): DirectoryUser => ({
  id: row.id,
  username: row.username,
  tenantKey: row.tenant_key,
  isSuperuser: row.is_superuser === 1,
  dateJoined: row.date_joined,
});

/** Applies every pending Directory migration; safe to run again. */
export function runDirectoryMigrations(sql: SqlStorage): void {
  sql.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(
    sql.exec<{ version: number }>("SELECT version FROM schema_migrations").toArray().map((row) => row.version),
  );
  directoryMigrations.forEach((statements, index) => {
    const version = index + 1;
    if (applied.has(version)) return;
    sql.exec(statements);
    sql.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", version, new Date().toISOString());
  });
}

export function countUsers(sql: SqlStorage): number {
  return sql.exec<{ n: number }>("SELECT count(*) AS n FROM users").one().n;
}

/** Inserts the user, or returns null when the username or tenant key is already taken. */
export function insertUser(
  sql: SqlStorage,
  username: string,
  tenantKey: string,
  isSuperuser: boolean,
  now: string,
): DirectoryUser | null {
  const row = sql
    .exec<DirectoryUserRow>(
      "INSERT OR IGNORE INTO users (username, tenant_key, is_superuser, date_joined) VALUES (?, ?, ?, ?) RETURNING *",
      username,
      tenantKey,
      isSuperuser ? 1 : 0,
      now,
    )
    .toArray()[0];
  return row ? toDirectoryUser(row) : null;
}

export function findUser(sql: SqlStorage, username: string): DirectoryUser | null {
  const row = sql.exec<DirectoryUserRow>("SELECT * FROM users WHERE username = ?", username).toArray()[0];
  return row ? toDirectoryUser(row) : null;
}

export function deleteUser(sql: SqlStorage, id: number): void {
  sql.exec("DELETE FROM users WHERE id = ?", id);
}
