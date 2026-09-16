import type { FC } from "hono/jsx";
import { type BookmarkRow, LIST_SORTS, type ListSort } from "../db/bookmarks";
import type { User } from "../db/users";
import { absoluteDate, archiveTimestamp, relativeDate } from "../lib/dates";
import { pageUrl, tagsIn, withoutTag, withTag } from "../lib/query";
import type { PageSignals } from "../lib/signals";
import { current, Layout } from "./layout";

/** Builds a link to this page with the query changed; see `pageUrl`. */
type LinkTo = (changes: Record<string, string | null>) => string;

export type Listing = PageSignals & {
  archived: boolean;
  items: { row: BookmarkRow; tags: string[] }[];
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

const pathOf = (archived: boolean) => (archived ? "/bookmarks/archived" : "/bookmarks");

/** Links to the listing's own page with its query changed; the query is written back from the signals, defaults left out. */
function linkTo({ archived, q, sort, unread }: Listing): LinkTo {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== "added_desc") params.set("sort", sort);
  if (unread) params.set("unread", "yes");
  return (changes) => pageUrl(pathOf(archived), params, changes);
}

/** The signals the page declares: its query as the actions post it back, the page kind, and an empty selection. */
const pageSignals = ({ q, sort, unread, page, archived }: Listing): string =>
  JSON.stringify({ q, sort, unread: unread ? "yes" : "", page, archived, selected: {}, selectAcross: false, bulkTags: "", action: "" });

export const BookmarkPage: FC<{ user: User } & Listing> = ({ user, ...listing }) => {
  const { archived, q, sort, unread } = listing;
  const link = linkTo(listing);
  return (
    <Layout title={archived ? "Archived bookmarks" : "Bookmarks"} user={user} section={archived ? "archived" : "bookmarks"}>
      <SearchForm path={pathOf(archived)} q={q} sort={sort} unread={unread} link={link} />
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
      <div class="listing" data-signals={pageSignals(listing)}>
        <section>
          <BulkBar {...listing} />
          <BookmarkList {...listing} link={link} />
          <Pagination {...listing} link={link} />
        </section>
        <Sidebar {...listing} link={link} />
      </div>
    </Layout>
  );
};

/** Every element an action patches, concatenated: Datastar morphs each by id wherever it sits on the page. */
export const ListFragments: FC<Listing> = (listing) => {
  const link = linkTo(listing);
  return (
    <>
      <BulkBar {...listing} />
      <BookmarkList {...listing} link={link} />
      <Pagination {...listing} link={link} />
      <Sidebar {...listing} link={link} />
    </>
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

const post = (path: string) => `@post('${path}')`;
const bulk = (action: string) => `$action = '${action}'; ${post("/bookmarks/bulk")}`;

/**
 * The selection controls and bulk actions. The server writes this page's item keys into the Select all handler and
 * the expression that shows Select across once every item is selected; only integers ever land in an expression.
 */
const BulkBar: FC<Listing> = ({ archived, items }) => {
  const keys = items.map(({ row }) => `b${row.id}`);
  const allSelected = keys.map((key) => `$selected.${key}`).join(" && ") || "false";
  return (
    <div id="bulk-bar">
      <span>
        <span data-text="Object.values($selected).filter(Boolean).length"></span> selected
      </span>
      <label>
        <input
          type="checkbox"
          data-on:change={`$selected = {${keys.map((key) => `${key}: evt.target.checked`).join(", ")}}`}
          data-effect={`el.checked = ${allSelected}`}
        />{" "}
        Select all
      </label>
      <label data-show={allSelected}>
        <input type="checkbox" data-bind="selectAcross" /> Select across all pages
      </label>
      <button type="button" data-on:click={bulk(archived ? "unarchive" : "archive")}>
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button type="button" data-on:click={`$action = 'delete'; confirm('Delete the selected bookmarks?') && ${post("/bookmarks/bulk")}`}>
        Delete
      </button>
      <button type="button" data-on:click={bulk("read")}>
        Mark read
      </button>
      <button type="button" data-on:click={bulk("unread")}>
        Mark unread
      </button>
      <input data-bind="bulkTags" placeholder="tags" aria-label="Tags" autocomplete="off" />
      <button type="button" data-on:click={bulk("tag")}>
        Tag
      </button>
      <button type="button" data-on:click={bulk("untag")}>
        Untag
      </button>
    </div>
  );
};

const BookmarkList: FC<Listing & { link: LinkTo }> = ({ items, empty, archived, link, now }) => (
  <ul id="bookmark-list">
    {empty && <li class="empty">{empty}</li>}
    {items.map(({ row, tags }) => (
      <BookmarkItem row={row} tags={tags} archived={archived} link={link} now={now} />
    ))}
  </ul>
);

const Pagination: FC<{ page: number; pages: number; link: LinkTo }> = ({ page, pages, link }) => (
  <nav id="pagination" class="pagination" aria-label="Pages">
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

const BookmarkItem: FC<{ row: BookmarkRow; tags: string[]; archived: boolean; link: LinkTo; now: number }> = ({
  row,
  tags,
  archived,
  link,
  now,
}) => {
  const name = row.title || row.url;
  return (
    <li id={`bookmark-${row.id}`} class={row.unread ? "unread" : undefined}>
      <input type="checkbox" aria-label={`Select ${name}`} {...{ [`data-bind:selected.b${row.id}`]: "" }} />{" "}
      <a class="title" href={row.url} target="_blank" rel="noopener">
        {name}
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
      <p class="actions">
        <a
          class="date"
          href={`https://web.archive.org/web/${archiveTimestamp(row.date_added)}/${row.url}`}
          title={absoluteDate(row.date_added)}
          target="_blank"
          rel="noopener"
        >
          {relativeDate(row.date_added, now)}
        </a>{" "}
        <a class="edit" href={`/bookmarks/${row.id}/edit`} aria-label={`Edit ${name}`}>
          Edit
        </a>
        <button type="button" data-on:click={post(`/bookmarks/${row.id}/${archived ? "unarchive" : "archive"}`)}>
          {archived ? "Unarchive" : "Archive"}
        </button>
        <button type="button" data-on:click={`confirm('Delete this bookmark?') && ${post(`/bookmarks/${row.id}/delete`)}`}>
          Delete
        </button>
        {row.unread ? (
          <button type="button" data-on:click={post(`/bookmarks/${row.id}/read`)}>
            Mark read
          </button>
        ) : null}
      </p>
    </li>
  );
};
