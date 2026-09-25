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
  `CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    unread INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    shared INTEGER NOT NULL DEFAULT 0,
    date_added TEXT NOT NULL,
    date_modified TEXT NOT NULL
  );
  CREATE INDEX bookmarks_list ON bookmarks(is_archived, date_added DESC);
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    date_added TEXT NOT NULL
  );
  CREATE TABLE bookmark_tags (
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (bookmark_id, tag_id)
  );
  CREATE INDEX bookmark_tags_tag ON bookmark_tags(tag_id);
  CREATE TABLE api_tokens (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL
  );`,
  `CREATE TABLE feed_tokens (
    key TEXT PRIMARY KEY,
    created TEXT NOT NULL
  );`,
  `CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id),
    asset_type TEXT NOT NULL DEFAULT 'snapshot',
    content_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'failure')),
    date_created TEXT NOT NULL
  );
  CREATE INDEX assets_bookmark ON assets(bookmark_id, date_created);
  ALTER TABLE bookmarks ADD COLUMN latest_snapshot_id INTEGER REFERENCES assets(id);`,
  `CREATE TABLE bundles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    search TEXT NOT NULL DEFAULT '',
    any_tags TEXT NOT NULL DEFAULT '',
    all_tags TEXT NOT NULL DEFAULT '',
    excluded_tags TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL
  );`,
];

/** Applies every pending migration of `list`, the Tenant's by default; safe to run again. */
export function runMigrations(sql: SqlStorage, list: string[] = migrations): void {
  sql.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    sql.exec<{ version: number }>("SELECT version FROM schema_migrations").toArray().map((row) => row.version),
  );
  list.forEach((statements, index) => {
    const version = index + 1;
    if (applied.has(version)) return;
    sql.exec(statements);
    sql.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", version, new Date().toISOString());
  });
}

/** Throws when the database cannot answer a trivial query. */
export function ping(sql: SqlStorage): void {
  sql.exec("SELECT 1").toArray();
}
