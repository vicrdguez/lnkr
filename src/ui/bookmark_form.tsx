import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { EMPTY_BOOKMARK, findBookmarkByUrl, saveBookmark, toFields } from "../db/bookmarks";
import { isHttpUrl } from "../lib/url";
import { BookmarkForm, ClosePage, EMPTY_FORM, type FormValues } from "../views/bookmark_form";
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
