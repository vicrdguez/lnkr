import { Hono } from "hono";
import type { AppEnv } from "../app";
import { BookmarkForm, EMPTY_FORM, type FormValues } from "../views/bookmark_form";

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
