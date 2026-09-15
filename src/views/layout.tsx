import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "../db/users";

export type Section = "bookmarks" | "archived" | "settings";

export const Layout: FC<PropsWithChildren<{ title: string; user?: User | null; section?: Section }>> = ({
  title,
  user,
  section,
  children,
}) => (
  <>
    {/* The only unescaped fragment: a constant doctype, which JSX cannot express. */}
    {raw("<!doctype html>")}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · lnkr</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body>
        <nav>
          <strong>lnkr</strong>
          {user && (
            <>
              <a href="/bookmarks" class={section === "bookmarks" ? "active" : undefined}>
                Bookmarks
              </a>
              <a href="/bookmarks/archived" class={section === "archived" ? "active" : undefined}>
                Archived
              </a>
              <a href="/settings" class={section === "settings" ? "active" : undefined}>
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
