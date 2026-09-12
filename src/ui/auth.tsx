import { Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword, verifyPassword } from "../auth/password";
import { endSession, requireSession, sessionUser, startSession } from "../auth/session";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "../db/sessions";
import { countUsers, createUser, findUserByUsername } from "../db/users";
import { ErrorMessage, Field, Layout } from "../views/layout";
import { formFields } from "./form";

const SetupPage = ({ error }: { error?: string }) => (
  <Layout title="Set up lnkr">
    <ErrorMessage message={error} />
    <form method="post">
      <Field label="Username" name="username" />
      <Field label="Password" name="password" type="password" />
      <button>Create account</button>
    </form>
  </Layout>
);

const LoginPage = ({ error }: { error?: string }) => (
  <Layout title="Log in">
    <ErrorMessage message={error} />
    <form method="post">
      <Field label="Username" name="username" />
      <Field label="Password" name="password" type="password" />
      <button>Log in</button>
    </form>
  </Layout>
);

export const auth = new Hono<AppEnv>();

auth.get("/", (c) => c.redirect(sessionUser(c) ? "/settings" : "/login"));

auth.get("/setup", (c) => (countUsers(c.get("sql")) ? c.redirect("/login") : c.html(<SetupPage />)));

auth.post("/setup", async (c) => {
  const sql = c.get("sql");
  if (countUsers(sql)) return c.redirect("/login");
  const { username, password } = await formFields(c, "username", "password");
  const name = username.trim();
  if (!name || !password) return c.html(<SetupPage error="Username and password are required." />, 400);
  const passwordHash = await hashPassword(password);
  // Hashing yielded; another request may have completed setup meanwhile.
  if (countUsers(sql)) return c.redirect("/login");
  const user = createUser(sql, name, passwordHash, new Date().toISOString());
  startSession(c, user.id);
  return c.redirect("/");
});

auth.get("/login", (c) => c.html(<LoginPage />));

auth.post("/login", async (c) => {
  const sql = c.get("sql");
  const { username, password } = await formFields(c, "username", "password");
  if (isLoginLocked(sql, username, new Date().toISOString())) {
    return c.html(<LoginPage error="Too many attempts. Try again later." />, 429);
  }
  const user = findUserByUsername(sql, username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(sql, username, new Date().toISOString());
    return c.html(<LoginPage error="Invalid username or password" />, 401);
  }
  clearLoginFailures(sql, username);
  startSession(c, user.id);
  return c.redirect(sameOriginPath(c.req.query("next"), c.req.url));
});

auth.post("/logout", requireSession, (c) => {
  endSession(c);
  return c.redirect("/login");
});

/** `next` when it is a path on this origin, otherwise `/`. */
function sameOriginPath(next: string | undefined, requestUrl: string): string {
  if (!next?.startsWith("/")) return "/";
  return new URL(next, requestUrl).origin === new URL(requestUrl).origin ? next : "/";
}
