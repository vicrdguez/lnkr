import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword, verifyPassword } from "../auth/password";
import { createToken, currentToken, deleteTokens } from "../db/tokens";
import { updatePassword, type User } from "../db/users";
import { ErrorMessage, Field, Layout } from "../views/layout";
import { formFields } from "./form";

const SettingsPage = ({ user, token, error }: { user: User; token: string; error?: string }) => (
  <Layout title="Settings" user={user} section="settings">
    <ErrorMessage message={error} />
    <h2>API token</h2>
    <p>
      <code id="api-token">{token}</code>
    </p>
    <form method="post" action="/settings/token/regenerate">
      <button>Regenerate</button>
    </form>
    <h2>Change password</h2>
    <form method="post" action="/settings/password">
      <Field label="Current password" name="current" type="password" autocomplete="current-password" />
      <Field label="New password" name="password" type="password" autocomplete="new-password" />
      <Field label="Confirm new password" name="confirm" type="password" autocomplete="new-password" />
      <button>Change password</button>
    </form>
  </Layout>
);

/** The settings page with the Tenant's token, created on first view. */
const settingsPage = (c: Context<AppEnv>, error?: string) => {
  const sql = c.get("sql");
  const token = currentToken(sql) ?? createToken(sql, new Date().toISOString());
  return <SettingsPage user={c.get("user")} token={token} error={error} />;
};

export const settings = new Hono<AppEnv>();

settings.get("/settings", (c) => c.html(settingsPage(c)));

settings.post("/settings/token/regenerate", (c) => {
  const sql = c.get("sql");
  deleteTokens(sql);
  createToken(sql, new Date().toISOString());
  return c.redirect("/settings");
});

settings.post("/settings/password", async (c) => {
  const user = c.get("user");
  const { current, password, confirm } = await formFields(c, "current", "password", "confirm");
  const reject = (error: string) => c.html(settingsPage(c, error), 400);
  if (!password || password !== confirm) return reject("New password and confirmation do not match.");
  if (!(await verifyPassword(current, user.passwordHash))) return reject("Current password is incorrect.");
  updatePassword(c.get("sql"), user.id, await hashPassword(password));
  return c.redirect("/settings");
});
