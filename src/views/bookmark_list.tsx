import type { FC } from "hono/jsx";
import type { BookmarkRow, ListSort } from "../db/bookmarks";
import type { User } from "../db/users";
import { absoluteDate, archiveTimestamp, relativeDate } from "../lib/dates";
import { pageUrl } from "../lib/query";
import { Layout } from "./layout";

/** A link to this page with the query changed; see `pageUrl`. */
type Link = (changes: Record<string, string | null>) => string;

export type Listing = {
  archived: boolean;
  /** The page's own path and query, which every link keeps. */
  path: string;
  params: URLSearchParams;
  q: string;
  sort: ListSort;
  unread: boolean;
  items: { row: BookmarkRow; tags: string[] }[];
  page: number;
  pages: number;
  tags: { name: string; count: number }[];
  /** The message shown instead of items when there are none. */
  empty: string | null;
  now: number;
};

const SORTS: [ListSort, string][] = [
  ["added_desc", "Newest"],
  ["added_asc", "Oldest"],
  ["title_asc", "Title A–Z"],
  ["title_desc", "Title Z–A"],
];

export const BookmarkPage: FC<{ user: User } & Listing> = ({ user, archived, path, params, items, empty, now, ...rest }) => {
  const { q, sort, unread, page, pages } = rest;
  const link: Link = (changes) => pageUrl(path, params, changes);
  const active = (on: boolean) => (on ? "active" : undefined);
  return (
    <Layout
      title={archived ? "Archived bookmarks" : "Bookmarks"}
      user={user}
      section={archived ? "archived" : "bookmarks"}
    >
      <form class="search" method="get" action={path}>
        <input type="search" name="q" value={q} placeholder="Search" aria-label="Search" />
        {sort !== "added_desc" && <input type="hidden" name="sort" value={sort} />}
        {unread && <input type="hidden" name="unread" value="yes" />}
        <button>Search</button>
        <a href={link({ q: null })}>Clear</a>
      </form>
      <p class="toolbar">
        {SORTS.map(([value, label]) => (
          <a href={link({ sort: value })} class={active(value === sort)}>
            {label}
          </a>
        ))}
        <a href={link({ unread: unread ? null : "yes" })} class={active(unread)}>
          Unread
        </a>
      </p>
      <div class="listing">
        <section>
          {empty && <p class="empty">{empty}</p>}
          <ul id="bookmark-list">
            {items.map(({ row, tags }) => (
              <BookmarkItem row={row} tags={tags} link={link} now={now} />
            ))}
          </ul>
          <nav class="pagination" aria-label="Pages">
            {page > 1 && <a href={link({ page: String(page - 1) })}>Previous</a>}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && <a href={link({ page: String(page + 1) })}>Next</a>}
          </nav>
        </section>
        <aside id="sidebar" />
      </div>
    </Layout>
  );
};

const BookmarkItem: FC<{ row: BookmarkRow; tags: string[]; link: Link; now: number }> = ({ row, tags, link, now }) => (
  <li id={`bookmark-${row.id}`} class={row.unread ? "unread" : undefined}>
    <a class="title" href={row.url} target="_blank" rel="noopener">
      {row.title || row.url}
    </a>
    {row.description && <p class="description">{row.description}</p>}
    {tags.length > 0 && (
      <p class="tags">
        {tags.map((name) => (
          <a class="tag" href={link({ q: `#${name}` })}>
            #{name}
          </a>
        ))}
      </p>
    )}
    {row.notes && (
      <details class="notes">
        <summary>Notes</summary>
        <pre>{row.notes}</pre>
      </details>
    )}
    <a
      class="date"
      href={`https://web.archive.org/web/${archiveTimestamp(row.date_added)}/${row.url}`}
      title={absoluteDate(row.date_added)}
      target="_blank"
      rel="noopener"
    >
      {relativeDate(row.date_added, now)}
    </a>
  </li>
);
