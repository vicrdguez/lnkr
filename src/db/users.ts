export type User = {
  id: number;
  username: string;
  passwordHash: string;
  prefs: string;
  dateJoined: string;
  lastLogin: string | null;
};

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  prefs: string;
  date_joined: string;
  last_login: string | null;
};

export const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  prefs: row.prefs,
  dateJoined: row.date_joined,
  lastLogin: row.last_login,
});

export function countUsers(sql: SqlStorage): number {
  return sql.exec<{ n: number }>("SELECT count(*) AS n FROM users").one().n;
}

export function createUser(sql: SqlStorage, username: string, passwordHash: string, now: string): User {
  return toUser(
    sql
      .exec<UserRow>(
        "INSERT INTO users (username, password_hash, date_joined) VALUES (?, ?, ?) RETURNING *",
        username,
        passwordHash,
        now,
      )
      .one(),
  );
}

export function findUserByUsername(sql: SqlStorage, username: string): User | null {
  const row = sql.exec<UserRow>("SELECT * FROM users WHERE username = ?", username).toArray()[0];
  return row ? toUser(row) : null;
}

export function updatePassword(sql: SqlStorage, id: number, passwordHash: string): void {
  sql.exec("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, id);
}
