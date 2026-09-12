/** Schema migrations in order; version equals array index plus one. */
export const migrations: string[] = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    prefs TEXT NOT NULL DEFAULT '{}',
    date_joined TEXT NOT NULL,
    last_login TEXT
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE login_attempts (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    failures INTEGER NOT NULL,
    window_start TEXT NOT NULL
  );`,
];

/** Applies every pending migration; safe to run again. */
export function runMigrations(sql: SqlStorage): void {
  sql.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    sql.exec<{ version: number }>("SELECT version FROM schema_migrations").toArray().map((row) => row.version),
  );
  migrations.forEach((statements, index) => {
    const version = index + 1;
    if (applied.has(version)) return;
    sql.exec(statements);
    sql.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", version, new Date().toISOString());
  });
}
