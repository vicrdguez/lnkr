import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { hashPassword, verifyPassword } from "../auth/password";
import { allBookmarks, tagNamesFor, toFields } from "../db/bookmarks";
import { importEntries } from "../db/import";
import { createToken, currentToken, deleteTokens } from "../db/tokens";
import { updatePassword, type User } from "../db/users";
import { readPrefs, writePrefs } from "../prefs";
import { parseNetscape, renderNetscape } from "../services/netscape";
import { ErrorMessage, Field, Layout } from "../views/layout";
import { formFields } from "./form";

/** Opens the new-bookmark form for the current page in a window that closes itself once saved. */
const bookmarklet = (origin: string) =>
  `javascript:window.open('${origin}/bookmarks/new?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&auto_close')`;

type Messages = { error?: string; notice?: string };

const SettingsPage = ({ user, token, origin, error, notice }: { user: User; token: string; origin: string } & Messages) => (
  <Layout title="Settings" user={user} section="settings">
    <ErrorMessage message={error} />
    {notice && <p role="status">{notice}</p>}
    <h2>Bookmarklet</h2>
    <p>
      Drag this link to your bookmarks bar: <a href={bookmarklet(origin)}>Save to lnkr</a>
    </p>
    <h2>API token</h2>
    <p>
      <code id="api-token">{token}</code>
    </p>
    <form method="post" action="/settings/token/regenerate">
      <button>Regenerate</button>
    </form>
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
    <h2>Import</h2>
    <form method="post" action="/settings/import" enctype="multipart/form-data">
      <Field label="Bookmarks file" name="file" type="file" />
      <label class="checkbox">
        <input type="checkbox" name="map_private_flag" /> Mark entries with PRIVATE="0" as shared
      </label>
      <p class="hint">
        A Netscape bookmark file, as linkding and browsers export it. Existing URLs are updated and their tags merged.
      </p>
      <button>Import</button>
    </form>
    <h2>Export</h2>
    <p>
      <a href="/settings/export">Download bookmarks.html</a>, the Netscape bookmark file linkding and browsers read.
    </p>
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
const settingsPage = (c: Context<AppEnv>, messages: Messages = {}) => {
  const sql = c.get("sql");
  const token = currentToken(sql) ?? createToken(sql, new Date().toISOString());
  return <SettingsPage user={c.get("user")} token={token} origin={new URL(c.req.url).origin} {...messages} />;
};

export const settings = new Hono<AppEnv>();

settings.get("/settings", (c) => c.html(settingsPage(c)));

/** Every Bookmark, oldest first, as a linkding-compatible Netscape file. */
settings.get("/settings/export", (c) => {
  const sql = c.get("sql");
  const rows = allBookmarks(sql);
  const tags = tagNamesFor(sql, rows.map((row) => row.id));
  const entries = rows.map((row) => ({
    ...toFields(row),
    tags: tags.get(row.id) ?? [],
    dateAdded: row.date_added,
    dateModified: row.date_modified,
  }));
  return c.body(renderNetscape(entries), 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": 'attachment; filename="bookmarks.html"',
  });
});

/** Imports a Netscape file whole, in one transaction, and reports the counts on the settings page. */
settings.post("/settings/import", async (c) => {
  const form = await c.req.formData().catch(() => new FormData());
  const file = form.get("file");
  if (!(file instanceof File)) return c.html(settingsPage(c, { error: "Choose a bookmarks file to import." }), 400);
  const now = new Date().toISOString();
  const entries = await parseNetscape(file.stream(), { mapPrivateFlag: form.has("map_private_flag"), now });
  const sql = c.get("sql");
  const { created, updated, skipped } = c.get("transaction")(() => importEntries(sql, entries, now));
  return c.html(settingsPage(c, { notice: `${created} created, ${updated} updated, ${skipped} skipped` }));
});

settings.post("/settings/token/regenerate", (c) => {
  const sql = c.get("sql");
  deleteTokens(sql);
  createToken(sql, new Date().toISOString());
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
