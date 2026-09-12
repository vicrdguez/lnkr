import { Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword } from "../auth/password";
import { startSession } from "../auth/session";
import { countUsers, createUser } from "../db/users";
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

export const auth = new Hono<AppEnv>();

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
