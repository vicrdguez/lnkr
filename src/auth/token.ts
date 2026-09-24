import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { apiTokenExists } from "../db/tokens";
import { firstUser } from "../db/users";
import { bareCredential } from "./credential";

/** Answers 401 in linkding's shape unless the request carries `Authorization: Token <key>` for a known key. */
export const requireToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const [scheme, key] = c.req.header("authorization")?.trim().split(/\s+/) ?? [];
  if (scheme?.toLowerCase() !== "token" || !key) {
    return c.json({ detail: "Authentication credentials were not provided." }, 401);
  }
  const sql = c.get("sql");
  const user = apiTokenExists(sql, bareCredential(key)) ? firstUser(sql) : null;
  if (!user) return c.json({ detail: "Invalid token." }, 401);
  c.set("user", user);
  await next();
};
