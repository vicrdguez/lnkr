import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import type { AppEnv } from "../app";
import { createSession, deleteSession, findSessionUser } from "../db/sessions";
import type { User } from "../db/users";

export const SESSION_COOKIE = "sessionid";
const DEFAULT_COOKIE_AGE = 1_209_600; // fourteen days, in seconds
/** Paths served without a session; `/` decides its own redirect by session. */
const PUBLIC_PATHS = new Set(["/", "/setup", "/login", "/health"]);

/** The user behind the request's session cookie, or null. */
export function sessionUser(c: Context<AppEnv>): User | null {
  const id = getCookie(c, SESSION_COOKIE);
  return id ? findSessionUser(c.get("sql"), id, new Date().toISOString()) : null;
}

/** Redirects to the login page unless the path is public or the request carries a valid session. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { pathname, search } = new URL(c.req.url);
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/static/")) return next();
  const user = sessionUser(c);
  // DEBT(#23/W1): next is remembered for POSTs too, so a stale Log out click lands on GET /logout (404) after login.
  if (!user) return c.redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  c.set("user", user);
  await next();
};

/** Writes a session row and the `sessionid` cookie for `userId`. */
export async function startSession(c: Context<AppEnv>, userId: number): Promise<void> {
  // DEBT(#23/W4): a negative value passes through (dead session, no Max-Age); above 34560000 setCookie throws and login answers 500.
  const maxAge = Number(c.env.LD_SESSION_COOKIE_AGE) || DEFAULT_COOKIE_AGE;
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  const id = createSession(c.get("sql"), userId, expiresAt);
  setCookie(c, SESSION_COOKIE, id, { ...cookieOptions(c), maxAge });
}

/** Deletes the request's session row and clears the cookie. */
export async function endSession(c: Context<AppEnv>): Promise<void> {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) deleteSession(c.get("sql"), id);
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

/** Attributes shared by the session cookie and the response that clears it. */
function cookieOptions(c: Context<AppEnv>): CookieOptions {
  return { httpOnly: true, sameSite: "Lax", path: "/", secure: new URL(c.req.url).protocol === "https:" };
}
