import { Hono } from "hono";
import type { AppEnv } from "../app";
import type { User } from "../db/users";
import { ErrorMessage, Field, Layout } from "../views/layout";

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
