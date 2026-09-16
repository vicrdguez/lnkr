import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "../db/users";

export type Section = "bookmarks" | "archived" | "settings";

/** The only unescaped fragment: a constant doctype, which JSX cannot express; the close page shares it. */
export const DOCTYPE = raw("<!doctype html>");

/** The attributes marking the current choice among links: the `active` class and `aria-current`. */
export const current = (on: boolean, value = "page") => (on ? { class: "active", "aria-current": value } : {});

export const Layout: FC<PropsWithChildren<{ title: string; user?: User | null; section?: Section }>> = ({
  title,
  user,
  section,
  children,
}) => (
  <>
    {DOCTYPE}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · lnkr</title>
        <link rel="stylesheet" href="/static/style.css" />
        <script type="module" src="/static/datastar.js"></script>
      </head>
      <body>
        <nav>
          <strong>lnkr</strong>
          {user && (
            <>
              <a href="/bookmarks" {...current(section === "bookmarks")}>
                Bookmarks
              </a>
              <a href="/bookmarks/archived" {...current(section === "archived")}>
                Archived
              </a>
              <a href="/bookmarks/new">Add bookmark</a>
              <a href="/settings" {...current(section === "settings")}>
                Settings
              </a>
              <form method="post" action="/logout">
                <button>Log out</button>
              </form>
            </>
          )}
        </nav>
        <main>
          <h1>{title}</h1>
          {children}
        </main>
      </body>
    </html>
  </>
);

export const Field: FC<{ label: string; name: string; type?: string; autocomplete?: string }> = ({
  label,
  name,
  type = "text",
  autocomplete,
}) => (
  <label>
    {label}
    <input name={name} type={type} autocomplete={autocomplete} required />
  </label>
);

export const ErrorMessage: FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p class="error" role="alert">
      {message}
    </p>
  ) : null;
