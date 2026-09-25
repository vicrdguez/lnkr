import { raw } from "hono/html";
import type { FC, PropsWithChildren } from "hono/jsx";
import type { User } from "../db/users";
import { DEFAULT_PREFS, readPrefs } from "../prefs";

/** The browser chrome colour, shared by the head's `theme-color` and the manifest. */
export const THEME_COLOR = "#1e1e1e";

export type Section = "bookmarks" | "archived" | "bundles" | "settings";

/** The only unescaped fragment: a constant doctype, which JSX cannot express; the close page shares it. */
export const DOCTYPE = raw("<!doctype html>");

/** The attributes marking the current choice among links: the `active` class and `aria-current`. */
export const current = (on: boolean, value = "page") => (on ? { class: "active", "aria-current": value } : {});

export const Layout: FC<PropsWithChildren<{ title: string; user?: User | null; section?: Section }>> = ({
  title,
  user,
  section,
  children,
}) => {
  const prefs = user ? readPrefs(user) : DEFAULT_PREFS;
  const bodyClass = [prefs.sticky_pagination && "sticky-pagination", prefs.collapse_side_panel && "side-panel-collapsed"]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      {DOCTYPE}
      <html lang="en" data-theme={prefs.theme}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title} · lnkr</title>
          <link rel="stylesheet" href="/static/style.css" />
          {prefs.custom_css_hash && <link rel="stylesheet" href={`/custom_css?v=${prefs.custom_css_hash}`} />}
          <link rel="manifest" href="/manifest.json" />
          <link rel="search" type="application/opensearchdescription+xml" title="lnkr" href="/opensearch.xml" />
          <meta name="theme-color" content={THEME_COLOR} />
          <link rel="apple-touch-icon" href="/static/icon.svg" />
          <script type="module" src="/static/datastar.js"></script>
        </head>
        <body class={bodyClass || undefined}>
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
                <a href="/bundles" {...current(section === "bundles")}>
                  Bundles
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
};

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
