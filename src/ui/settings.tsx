import { Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword, verifyPassword } from "../auth/password";
import { updatePassword, type User } from "../db/users";
import { ErrorMessage, Field, Layout } from "../views/layout";
import { formFields } from "./form";

const SettingsPage = ({ user, error }: { user: User; error?: string }) => (
  <Layout title="Settings" user={user}>
    <ErrorMessage message={error} />
    <h2>Change password</h2>
    <form method="post" action="/settings/password">
      <Field label="Current password" name="current" type="password" />
      <Field label="New password" name="password" type="password" />
      <Field label="Confirm new password" name="confirm" type="password" />
      <button>Change password</button>
    </form>
  </Layout>
);

export const settings = new Hono<AppEnv>();

settings.get("/settings", (c) => c.html(<SettingsPage user={c.get("user")} />));

settings.post("/settings/password", async (c) => {
  const user = c.get("user");
  const { current, password, confirm } = await formFields(c, "current", "password", "confirm");
  const reject = (error: string) => c.html(<SettingsPage user={user} error={error} />, 400);
  if (!password || password !== confirm) return reject("New password and confirmation do not match.");
  if (!(await verifyPassword(current, user.passwordHash))) return reject("Current password is incorrect.");
  updatePassword(c.get("sql"), user.id, await hashPassword(password));
  return c.redirect("/settings");
});
