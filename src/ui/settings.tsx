import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword, verifyPassword } from "../auth/password";
import { type ApiToken, createApiToken, deleteApiToken, getOrCreateFeedToken, listApiTokens } from "../db/tokens";
import { updatePassword, type User } from "../db/users";
import { absoluteDate } from "../lib/dates";
import { readPrefs, writePrefs } from "../prefs";
import { ErrorMessage, Field, Layout } from "../views/layout";
import { formFields } from "./form";

/** Opens the new-bookmark form for the current page in a window that closes itself once saved. */
const bookmarklet = (origin: string) =>
  `javascript:window.open('${origin}/bookmarks/new?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&auto_close')`;

type SettingsProps = {
  user: User;
  tokens: ApiToken[];
  feedToken: string;
  origin: string;
  /** The key of a token created by this request, shown this once. */
  newToken?: string;
  error?: string;
};

const SettingsPage = ({ user, tokens, feedToken, origin, newToken, error }: SettingsProps) => (
  <Layout title="Settings" user={user} section="settings">
    <ErrorMessage message={error} />
    <h2>Bookmarklet</h2>
    <p>
      Drag this link to your bookmarks bar: <a href={bookmarklet(origin)}>Save to lnkr</a>
    </p>
    <h2>Integrations</h2>
    <h3>API tokens</h3>
    {newToken && (
      <p>
        Copy your new token now, it is not shown again: <code id="new-token">{newToken}</code>
      </p>
    )}
    <ul id="api-tokens">
      {tokens.map((token) => (
        <li class="actions">
          <span class="name">{token.name || "Default"}</span>
          <time datetime={token.created}>{absoluteDate(token.created)}</time>
          <form method="post" action={`/settings/tokens/${token.id}/revoke`}>
            <button>Revoke</button>
          </form>
        </li>
      ))}
    </ul>
    <form method="post" action="/settings/tokens">
      <Field label="Name" name="name" />
      <button>Create token</button>
    </form>
    <h3>Feeds</h3>
    <p>
      <a id="feed-all" href={`${origin}/feeds/${feedToken}/all`}>All bookmarks</a> ·{" "}
      <a id="feed-unread" href={`${origin}/feeds/${feedToken}/unread`}>Unread bookmarks</a>
    </p>
    <h2>Favicons</h2>
    <form method="post" action="/settings/favicons">
      <label class="checkbox">
        <input type="checkbox" name="enable_favicons" checked={readPrefs(user).enable_favicons} /> Show favicons next to
        bookmarks
      </label>
      <p class="hint">
        Your browser loads each icon from the favicon provider, which therefore learns the hosts you have bookmarked.
      </p>
      <button>Save</button>
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

/** The settings page with the Tenant's API tokens and its feed token, created on first view. */
const settingsPage = (c: Context<AppEnv>, extra: Pick<SettingsProps, "newToken" | "error"> = {}) => {
  const sql = c.get("sql");
  const feedToken = getOrCreateFeedToken(sql, new Date().toISOString());
  const origin = new URL(c.req.url).origin;
  return <SettingsPage user={c.get("user")} tokens={listApiTokens(sql)} feedToken={feedToken} origin={origin} {...extra} />;
};

export const settings = new Hono<AppEnv>();

settings.get("/settings", (c) => c.html(settingsPage(c)));

settings.post("/settings/tokens", async (c) => {
  const name = (await formFields(c, "name")).name.trim();
  if (!name) return c.html(settingsPage(c, { error: "A token needs a name." }), 400);
  const { key } = createApiToken(c.get("sql"), name, new Date().toISOString());
  return c.html(settingsPage(c, { newToken: key }));
});

settings.post("/settings/tokens/:id{[0-9]+}/revoke", (c) => {
  deleteApiToken(c.get("sql"), Number(c.req.param("id")));
  return c.redirect("/settings");
});

settings.post("/settings/favicons", async (c) => {
  const { enable_favicons } = await formFields(c, "enable_favicons");
  writePrefs(c.get("sql"), c.get("user"), { enable_favicons: !!enable_favicons });
  return c.redirect("/settings");
});

settings.post("/settings/password", async (c) => {
  const user = c.get("user");
  const { current, password, confirm } = await formFields(c, "current", "password", "confirm");
  const reject = (error: string) => c.html(settingsPage(c, { error }), 400);
  if (!password || password !== confirm) return reject("New password and confirmation do not match.");
  if (!(await verifyPassword(current, user.passwordHash))) return reject("Current password is incorrect.");
  updatePassword(c.get("sql"), user.id, await hashPassword(password));
  return c.redirect("/settings");
});
