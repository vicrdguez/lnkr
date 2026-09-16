import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { readSignals, requireDatastar, sse } from "../datastar";
import { EMPTY_BOOKMARK, findBookmarkByUrl, saveBookmark, tagNamesOf, toFields } from "../db/bookmarks";
import { isHttpUrl } from "../lib/url";
import { fetchPageMetadata } from "../services/metadata";
import { BookmarkForm, ClosePage, EMPTY_FORM, type FormValues, UrlHint } from "../views/bookmark_form";
import { formFields } from "./form";

/** The posted form: the URL trimmed, `tagNames` split from the space-separated field, flags by presence. */
async function readForm(c: Context<AppEnv>): Promise<{ values: FormValues; tagNames: string[]; autoClose: boolean }> {
  const f = await formFields(c, "url", "title", "description", "notes", "tags", "unread", "auto_close");
  const values = { url: f.url.trim(), title: f.title, description: f.description, notes: f.notes, tags: f.tags, unread: !!f.unread };
  return { values, tagNames: f.tags.split(/\s+/), autoClose: !!f.auto_close };
}

export const bookmarkForm = new Hono<AppEnv>();

bookmarkForm.get("/bookmarks/new", (c) => {
  const query = c.req.query();
  const values: FormValues = { ...EMPTY_FORM };
  for (const key of ["url", "title", "description", "notes", "tags"] as const) values[key] = query[key] ?? "";
  return c.html(
    <BookmarkForm
      user={c.get("user")}
      title="New bookmark"
      action="/bookmarks/new"
      values={values}
      autoClose={"auto_close" in query}
    />,
  );
});

/** Creates the Bookmark, or updates the one that already has the URL, and moves on to the list or the close page. */
bookmarkForm.post("/bookmarks/new", async (c) => {
  const { values, tagNames, autoClose } = await readForm(c);
  if (!isHttpUrl(values.url)) {
    const form = <BookmarkForm user={c.get("user")} title="New bookmark" action="/bookmarks/new" values={values} autoClose={autoClose} error="Enter a valid URL." />;
    return c.html(form, 400);
  }
  const sql = c.get("sql");
  const existing = findBookmarkByUrl(sql, values.url);
  const fields = { ...(existing ? toFields(existing) : EMPTY_BOOKMARK), ...values, tags: tagNames };
  saveBookmark(sql, fields, new Date().toISOString(), existing?.id);
  return c.redirect(autoClose ? "/bookmarks/close" : "/bookmarks");
});

bookmarkForm.get("/bookmarks/close", (c) => c.html(<ClosePage />));

/** A signal as text; the client is not trusted to send strings. */
const text = (signal: unknown): string => (typeof signal === "string" ? signal : "");

/**
 * Patches `#url-hint` with the duplicate notice when the URL is bookmarked, filling every form signal from that
 * Bookmark; otherwise clears the hint and fills only an empty title and description from the page's metadata.
 */
bookmarkForm.get("/bookmarks/check", requireDatastar, async (c) => {
  const sql = c.get("sql");
  const signals = await readSignals(c);
  const url = text(signals.url).trim();
  return sse(async (stream) => {
    const existing = isHttpUrl(url) ? findBookmarkByUrl(sql, url) : null;
    stream.patchElements(String(<UrlHint id={existing?.id} />));
    if (existing) {
      const { title, description, notes, unread } = toFields(existing);
      const tags = tagNamesOf(sql, existing.id).join(" ");
      stream.patchSignals(JSON.stringify({ title, description, notes, tags, unread }));
      return;
    }
    if (!isHttpUrl(url)) return;
    const page = await fetchPageMetadata(url);
    const patch: Record<string, string> = {};
    for (const key of ["title", "description"] as const) {
      const found = page[key];
      if (found && !text(signals[key])) patch[key] = found;
    }
    if (Object.keys(patch).length) stream.patchSignals(JSON.stringify(patch));
  });
});
