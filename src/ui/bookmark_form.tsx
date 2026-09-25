import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { readSignals, requireDatastar, sse, text } from "../datastar";
import { type AssetRow, listAssets } from "../db/assets";
import {
  type BookmarkRow,
  EMPTY_BOOKMARK,
  findBookmarkByUrl,
  getBookmark,
  saveBookmark,
  tagNamesOf,
  toFields,
} from "../db/bookmarks";
import { suggestTags } from "../db/tags";
import { isHttpUrl } from "../lib/url";
import { readPrefs } from "../prefs";
import { fetchPageMetadata } from "../services/metadata";
import { BookmarkForm, ClosePage, EMPTY_FORM, type FormValues, TagSuggestions, UrlHint } from "../views/bookmark_form";
import { formFields } from "./form";

const MAX_SUGGESTIONS = 10;

/** The posted form: the URL trimmed, `tagNames` split from the space-separated field, flags by presence. */
async function readForm(c: Context<AppEnv>): Promise<{ values: FormValues; tagNames: string[]; autoClose: boolean }> {
  const f = await formFields(c, "url", "title", "description", "notes", "tags", "unread", "auto_close");
  const values = { url: f.url.trim(), title: f.title, description: f.description, notes: f.notes, tags: f.tags, unread: !!f.unread };
  return { values, tagNames: f.tags.split(/\s+/), autoClose: !!f.auto_close };
}

/** The form as the Bookmark fills it. */
function formValues(sql: SqlStorage, row: BookmarkRow): FormValues {
  const { url, title, description, notes, unread } = toFields(row);
  return { id: row.id, url, title, description, notes, unread, tags: tagNamesOf(sql, row.id).join(" ") };
}

const formPage = (
  c: Context<AppEnv>,
  title: string,
  action: string,
  values: FormValues,
  rest: { autoClose?: boolean; error?: string; assets?: AssetRow[] } = {},
) => <BookmarkForm user={c.get("user")} title={title} action={action} values={values} {...rest} />;

export const bookmarkForm = new Hono<AppEnv>();

bookmarkForm.get("/bookmarks/new", (c) => {
  const query = c.req.query();
  // The Default mark unread preference checks Unread unless the query says otherwise.
  const unread = query.unread === undefined ? readPrefs(c.get("user")).default_mark_unread : query.unread === "true";
  const values: FormValues = { ...EMPTY_FORM, unread };
  for (const key of ["url", "title", "description", "notes", "tags"] as const) values[key] = query[key] ?? "";
  // A share target sends the shared URL in `text` on Android; it fills an absent `url` only when it is one.
  if (!values.url && isHttpUrl(query.text ?? "")) values.url = query.text;
  return c.html(formPage(c, "New bookmark", "/bookmarks/new", values, { autoClose: "auto_close" in query }));
});

/** Creates the Bookmark, or updates the one that already has the URL, and moves on to the list or the close page. */
bookmarkForm.post("/bookmarks/new", async (c) => {
  const { values, tagNames, autoClose } = await readForm(c);
  if (!isHttpUrl(values.url)) {
    return c.html(formPage(c, "New bookmark", "/bookmarks/new", values, { autoClose, error: "Enter a valid URL." }), 400);
  }
  const sql = c.get("sql");
  const existing = findBookmarkByUrl(sql, values.url);
  const fields = { ...(existing ? toFields(existing) : EMPTY_BOOKMARK), ...values, tags: tagNames };
  saveBookmark(sql, fields, new Date().toISOString(), existing?.id);
  return c.redirect(autoClose ? "/bookmarks/close" : "/bookmarks");
});

bookmarkForm.get("/bookmarks/close", (c) => c.html(<ClosePage />));

/**
 * Patches `#url-hint` with the duplicate notice when another Bookmark has the URL, filling every form signal from
 * it on the new form; otherwise clears the hint and fills only an empty title and description from the page's
 * metadata. The edit form sends its Bookmark's `id`, so its own URL is no duplicate and a duplicate only warns.
 */
bookmarkForm.get("/bookmarks/check", requireDatastar, async (c) => {
  const sql = c.get("sql");
  const signals = (await readSignals(c)) ?? {};
  const url = text(signals.url).trim();
  const editing = typeof signals.id === "number" ? signals.id : undefined;
  return sse(async (stream) => {
    const existing = isHttpUrl(url) ? findBookmarkByUrl(sql, url) : null;
    const duplicate = existing && existing.id !== editing ? existing : null;
    stream.patchElements(String(<UrlHint id={duplicate?.id} />));
    if (duplicate && editing === undefined) {
      const { title, description, notes, tags, unread } = formValues(sql, duplicate);
      stream.patchSignals(JSON.stringify({ title, description, notes, tags, unread }));
    }
    if (existing || !isHttpUrl(url)) return;
    const page = await fetchPageMetadata(url);
    const patch: Record<string, string> = {};
    for (const key of ["title", "description"] as const) {
      const found = page[key];
      if (found && !text(signals[key])) patch[key] = found;
    }
    if (Object.keys(patch).length) stream.patchSignals(JSON.stringify(patch));
  });
});

/** Patches `#tag-suggestions` with the names completing the last typed token, none when that token is empty. */
bookmarkForm.get("/bookmarks/tags/suggest", requireDatastar, async (c) => {
  const typed = text((await readSignals(c))?.tags);
  const tokens = typed.split(/\s+/);
  const prefix = tokens.pop() ?? "";
  const names = prefix ? suggestTags(c.get("sql"), prefix, tokens, MAX_SUGGESTIONS) : [];
  return sse((stream) => {
    stream.patchElements(String(<TagSuggestions typed={typed} names={names} />));
  });
});

const EDIT_PATH = "/bookmarks/:id{[0-9]+}/edit";

bookmarkForm.get(EDIT_PATH, (c) => {
  const sql = c.get("sql");
  const row = getBookmark(sql, Number(c.req.param("id")));
  if (!row) return c.notFound();
  return c.html(formPage(c, "Edit bookmark", c.req.path, formValues(sql, row), { assets: listAssets(sql, row.id) }));
});

/** Replaces the Bookmark's fields and tags; its URL may move only onto one no other Bookmark has. */
bookmarkForm.post(EDIT_PATH, async (c) => {
  // The only await before storage is touched, so the lookups below cannot interleave with another request.
  const { values, tagNames } = await readForm(c);
  const sql = c.get("sql");
  const existing = getBookmark(sql, Number(c.req.param("id")));
  if (!existing) return c.notFound();
  const reject = (error: string) =>
    c.html(formPage(c, "Edit bookmark", c.req.path, { ...values, id: existing.id }, { error }), 400);
  if (!isHttpUrl(values.url)) return reject("Enter a valid URL.");
  const owner = findBookmarkByUrl(sql, values.url);
  if (owner && owner.id !== existing.id) return reject("A bookmark with this URL already exists.");
  saveBookmark(sql, { ...toFields(existing), ...values, tags: tagNames }, new Date().toISOString(), existing.id);
  return c.redirect("/bookmarks");
});
