import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { formatCredential } from "../auth/credential";
import { hashPassword, verifyPassword } from "../auth/password";
import { allBookmarks, tagNamesFor } from "../db/bookmarks";
import { importEntries } from "../db/import";
import { type ApiToken, createApiToken, deleteApiToken, getOrCreateFeedToken, listApiTokens } from "../db/tokens";
import { updatePassword, type User } from "../db/users";
import { absoluteDate } from "../lib/dates";
import { CHOICES, type Prefs, parseGeneralForm, readPrefs, writePrefs } from "../prefs";
import { entryOf, parseNetscape, renderNetscape } from "../services/netscape";
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
  /** The outcome of an action this request performed, such as import counts. */
  notice?: string;
};

/** What the General form shows for each enumerated value. */
const CHOICE_LABELS: Record<string, string> = {
  auto: "Same as system",
  light: "Light",
  dark: "Dark",
  relative: "Relative",
  absolute: "Absolute",
  hidden: "Hidden",
  inline: "Inline",
  separate: "Separate",
  _blank: "New tab",
  _self: "Same tab",
  strict: "Strict",
  lax: "Lax",
  alphabetical: "Alphabetical",
  disabled: "Disabled",
};

/** A select offering each allowed value of the enumerated preference `name`, the stored one selected. */
const Choice = ({ prefs, name, label }: { prefs: Prefs; name: keyof typeof CHOICES; label: string }) => (
  <label>
    {label}
    <select name={name}>
      {CHOICES[name].map((value) => (
        <option value={value} selected={prefs[name] === value}>
          {CHOICE_LABELS[value]}
        </option>
      ))}
    </select>
  </label>
);

type Flag = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

const Check = ({ prefs, name, label }: { prefs: Prefs; name: Flag; label: string }) => (
  <label class="checkbox">
    <input type="checkbox" name={name} checked={prefs[name]} /> {label}
  </label>
);

/** linkding's display and behaviour preferences, each at its stored value. */
const GeneralForm = ({ prefs }: { prefs: Prefs }) => (
  <form method="post" action="/settings/general">
    <Choice prefs={prefs} name="theme" label="Theme" />
    <Choice prefs={prefs} name="bookmark_date_display" label="Bookmark date format" />
    <Choice prefs={prefs} name="bookmark_description_display" label="Bookmark description" />
    <label>
      Bookmark description max lines
      <input type="number" name="bookmark_description_max_lines" min="1" value={String(prefs.bookmark_description_max_lines)} />
    </label>
    <Choice prefs={prefs} name="bookmark_link_target" label="Open bookmarks in" />
    <Check prefs={prefs} name="display_url" label="Show bookmark URL" />
    <Choice prefs={prefs} name="tag_search" label="Tag search" />
    <Choice prefs={prefs} name="tag_grouping" label="Tag grouping" />
    <Check prefs={prefs} name="sticky_pagination" label="Sticky pagination" />
    <Check prefs={prefs} name="collapse_side_panel" label="Collapse side panel" />
    <label>
      Items per page
      <input type="number" name="items_per_page" min="10" value={String(prefs.items_per_page)} />
    </label>
    <Check prefs={prefs} name="display_edit_bookmark_action" label="Show Edit" />
    <Check prefs={prefs} name="display_archive_bookmark_action" label="Show Archive" />
    <Check prefs={prefs} name="display_remove_bookmark_action" label="Show Delete" />
    <Check prefs={prefs} name="default_mark_unread" label="Mark new bookmarks unread" />
    <Check prefs={prefs} name="permanent_notes" label="Always show notes" />
    <label>
      Custom CSS
      <textarea name="custom_css">{prefs.custom_css}</textarea>
    </label>
    <button>Save</button>
  </form>
);

const SettingsPage = ({ user, tokens, feedToken, origin, newToken, error, notice }: SettingsProps) => (
  <Layout title="Settings" user={user} section="settings">
    <ErrorMessage message={error} />
    {notice && <p role="status">{notice}</p>}
    <h2>General</h2>
    <GeneralForm prefs={readPrefs(user)} />
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
    <h2>Auto tagging</h2>
    <form method="post" action="/settings/auto-tagging">
      <label>
        Rules
        <textarea name="rules" rows={8}>
          {/* A browser drops the first newline inside <textarea>, so one is given for it and a leading blank line survives. */}
          {`\n${readPrefs(user).auto_tagging_rules}`}
        </textarea>
      </label>
      <p class="hint">
        One rule per line: a URL pattern, then the tags to add, as in <code>github.com/sissbruecker code linkding</code>.
        The pattern is a host with an optional path, query and fragment; the host also matches its subdomains, the path
        and fragment match as prefixes, and a query key without a value matches any value. New bookmarks whose URL
        matches get the tags. Lines starting with <code>#</code> are comments.
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

/** The settings page with the Tenant's API tokens and its feed token, created on first view. */
const settingsPage = (c: Context<AppEnv>, extra: Pick<SettingsProps, "newToken" | "error" | "notice"> = {}) => {
  const sql = c.get("sql");
  const feedToken = formatCredential(c.get("tenantKey"), getOrCreateFeedToken(sql, new Date().toISOString()));
  const origin = new URL(c.req.url).origin;
  return <SettingsPage user={c.get("user")} tokens={listApiTokens(sql)} feedToken={feedToken} origin={origin} {...extra} />;
};

export const settings = new Hono<AppEnv>();

settings.get("/settings", (c) => c.html(settingsPage(c)));

/** Every Bookmark, oldest first, as a linkding-compatible Netscape file. */
settings.get("/settings/export", (c) => {
  const sql = c.get("sql");
  const rows = allBookmarks(sql);
  const tags = tagNamesFor(sql, rows.map((row) => row.id));
  return c.body(renderNetscape(rows.map((row) => entryOf(row, tags.get(row.id) ?? []))), 200, {
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

settings.post("/settings/tokens", async (c) => {
  const name = (await formFields(c, "name")).name.trim();
  if (!name) return c.html(settingsPage(c, { error: "A token needs a name." }), 400);
  const { key } = createApiToken(c.get("sql"), name, new Date().toISOString());
  return c.html(settingsPage(c, { newToken: formatCredential(c.get("tenantKey"), key) }));
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

/** Stores the Auto-tagging rules as typed; lines that are not rules are ignored when they are applied. */
settings.post("/settings/auto-tagging", async (c) => {
  const { rules } = await formFields(c, "rules");
  writePrefs(c.get("sql"), c.get("user"), { auto_tagging_rules: rules });
  return c.redirect("/settings");
});

/** Saves the General form whole; an invalid value takes its default rather than failing. */
settings.post("/settings/general", async (c) => {
  const patch = parseGeneralForm(await c.req.parseBody());
  patch.custom_css_hash = await cssHash(patch.custom_css ?? "");
  writePrefs(c.get("sql"), c.get("user"), patch);
  return c.redirect("/settings");
});

/** The first eight hex digits of the CSS's SHA-256, or empty for empty CSS so the layout links nothing. */
async function cssHash(css: string): Promise<string> {
  if (!css) return "";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(css)));
  return [...digest.slice(0, 4)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

settings.post("/settings/password", async (c) => {
  const user = c.get("user");
  const { current, password, confirm } = await formFields(c, "current", "password", "confirm");
  const reject = (error: string) => c.html(settingsPage(c, { error }), 400);
  if (!password || password !== confirm) return reject("New password and confirmation do not match.");
  if (!(await verifyPassword(current, user.passwordHash))) return reject("Current password is incorrect.");
  updatePassword(c.get("sql"), user.id, await hashPassword(password));
  return c.redirect("/settings");
});
