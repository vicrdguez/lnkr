import type { FC } from "hono/jsx";
import { type BookmarkRow, LIST_SORTS, type ListSort } from "../db/bookmarks";
import type { User } from "../db/users";
import { absoluteDate, archiveTimestamp, relativeDate } from "../lib/dates";
import { pageUrl, tagsIn, withoutTag, withTag } from "../lib/query";
import { current, Layout } from "./layout";

/** Builds a link to this page with the query changed; see `pageUrl`. */
type LinkTo = (changes: Record<string, string | null>) => string;

export type Listing = {
  archived: boolean;
  /** The page's own path and query; every link keeps both. */
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

const SORT_LABELS: Record<ListSort, string> = {
  added_desc: "Newest",
  added_asc: "Oldest",
  title_asc: "Title A–Z",
  title_desc: "Title Z–A",
};

export const BookmarkPage: FC<{ user: User } & Listing> = ({ user, archived, path, params, items, empty, now, ...rest }) => {
  const { q, sort, unread, page, pages, tags } = rest;
  const link: LinkTo = (changes) => pageUrl(path, params, changes);
  return (
    <Layout
      title={archived ? "Archived bookmarks" : "Bookmarks"}
      user={user}
      section={archived ? "archived" : "bookmarks"}
    >
      <SearchForm path={path} q={q} sort={sort} unread={unread} link={link} />
      <p class="toolbar">
        {LIST_SORTS.map((value) => (
          <a href={link({ sort: value })} {...current(value === sort, "true")}>
            {SORT_LABELS[value]}
          </a>
        ))}
        <a href={link({ unread: unread ? null : "yes" })} {...current(unread, "true")}>
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
          <Pagination page={page} pages={pages} link={link} />
        </section>
        <Sidebar tags={tags} q={q} link={link} />
      </div>
    </Layout>
  );
};

/** Submits `q` by GET to the page, keeping a non-default sort and the unread filter as hidden inputs. */
const SearchForm: FC<{ path: string; q: string; sort: ListSort; unread: boolean; link: LinkTo }> = ({
  path,
  q,
  sort,
  unread,
  link,
}) => (
  <form class="search" method="get" action={path}>
    <input type="search" name="q" value={q} placeholder="Search" aria-label="Search" />
    {sort !== "added_desc" && <input type="hidden" name="sort" value={sort} />}
    {unread && <input type="hidden" name="unread" value="yes" />}
    <button>Search</button>
    <a href={link({ q: null })}>Clear</a>
  </form>
);

const Pagination: FC<{ page: number; pages: number; link: LinkTo }> = ({ page, pages, link }) => (
  <nav class="pagination" aria-label="Pages">
    {page > 1 && <a href={link({ page: String(page - 1) })}>Previous</a>}
    <span>
      Page {page} of {pages}
    </span>
    {page < pages && <a href={link({ page: String(page + 1) })}>Next</a>}
  </nav>
);

const Sidebar: FC<{ tags: Listing["tags"]; q: string; link: LinkTo }> = ({ tags, q, link }) => {
  const selected = new Set(tagsIn(q));
  return (
    <aside id="sidebar">
      <h2>Tags</h2>
      <ul>
        {tags.map(({ name, count }) => {
          const on = selected.has(name.toLowerCase());
          return (
            <li class={on ? "selected" : undefined} aria-current={on ? "true" : undefined}>
              <a href={link({ q: on ? withoutTag(q, name) || null : withTag(q, name) })}>{name}</a>{" "}
              <span class="count">{count}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

const BookmarkItem: FC<{ row: BookmarkRow; tags: string[]; link: LinkTo; now: number }> = ({ row, tags, link, now }) => (
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
    </a>{" "}
    <a class="edit" href={`/bookmarks/${row.id}/edit`} aria-label={`Edit ${row.title || row.url}`}>
      Edit
    </a>
  </li>
);
