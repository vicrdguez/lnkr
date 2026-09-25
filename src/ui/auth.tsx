import { Hono } from "hono";
import type { AppEnv } from "../app";
import { verifyPassword } from "../auth/password";
import { endSession, sessionUser, startSession } from "../auth/session";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "../db/sessions";
import { findUserByUsername } from "../db/users";
import { INVALID_CREDENTIALS, LoginForm } from "../views/auth";
import { formFields } from "./form";

export const auth = new Hono<AppEnv>();

auth.get("/", (c) => c.redirect(sessionUser(c) ? "/bookmarks" : "/login"));

// Setup belongs to the Directory; a provisioned Tenant has nothing to set up.
auth.get("/setup", (c) => c.redirect("/login"));

auth.get("/login", (c) => c.html(<LoginForm />));

auth.post("/login", async (c) => {
  const sql = c.get("sql");
  const { username, password } = await formFields(c, "username", "password");
  if (isLoginLocked(sql, username, new Date().toISOString())) {
    return c.html(<LoginForm error="Too many attempts. Try again later." />, 429);
  }
  const user = findUserByUsername(sql, username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(sql, username, new Date().toISOString());
    return c.html(<LoginForm error={INVALID_CREDENTIALS} />, 401);
  }
  clearLoginFailures(sql, username);
  await startSession(c, user.id);
  return c.redirect(sameOriginPath(c.req.query("next"), c.req.url));
});

auth.post("/logout", async (c) => {
  await endSession(c);
  return c.redirect("/login");
});

/** `next` when it is a path on this origin, otherwise `/`. */
function sameOriginPath(next: string | undefined, requestUrl: string): string {
  if (!next?.startsWith("/")) return "/";
  // DEBT(#23/W2): control characters in next survive to c.redirect, which throws after the session is started (500).
  return new URL(next, requestUrl).origin === new URL(requestUrl).origin ? next : "/";
}
