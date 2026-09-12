import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../app";
import { createSession, deleteSession, findSessionUser } from "../db/sessions";
import type { User } from "../db/users";

export const SESSION_COOKIE = "sessionid";
const DEFAULT_COOKIE_AGE = 1_209_600; // fourteen days, in seconds

/** The user behind the request's session cookie, or null. */
export function sessionUser(c: Context<AppEnv>): User | null {
  const id = getCookie(c, SESSION_COOKIE);
  return id ? findSessionUser(c.get("sql"), id, new Date().toISOString()) : null;
}

/** Redirects to the login page unless the request carries a valid session. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = sessionUser(c);
  if (!user) {
    const { pathname, search } = new URL(c.req.url);
    return c.redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  c.set("user", user);
  await next();
};

/** Writes a session row and the `sessionid` cookie for `userId`. */
export function startSession(c: Context<AppEnv>, userId: number): void {
  const maxAge = Number(c.env.LD_SESSION_COOKIE_AGE ?? DEFAULT_COOKIE_AGE);
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  const id = createSession(c.get("sql"), userId, expiresAt);
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge,
    secure: new URL(c.req.url).protocol === "https:",
  });
}

/** Deletes the request's session row and clears the cookie. */
export function endSession(c: Context<AppEnv>): void {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) deleteSession(c.get("sql"), id);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
