import type { FC } from "hono/jsx";
import { type BookmarkRow, LIST_SORTS, type ListSort } from "../db/bookmarks";
import type { User } from "../db/users";
import { absoluteDate, archiveTimestamp, relativeDate } from "../lib/dates";
import { pageUrl, tagsIn, withoutTag, withTag } from "../lib/query";
import type { PageSignals } from "../lib/signals";
import type { Prefs } from "../prefs";
import { faviconUrl } from "../services/favicons";
import type { Action, ItemAction } from "../ui/bookmark_actions";
import { current, Layout } from "./layout";

/** Builds a link to this page with the query changed; see `pageUrl`. */
type LinkTo = (changes: Record<string, string | null>) => string;

export type Listing = PageSignals & {
  archived: boolean;
  /** The page's query; every link keeps it. */
  params: URLSearchParams;
  items: { row: BookmarkRow; tags: string[]; snapshots: number }[];
  pages: number;
  tags: { name: string; count: number }[];
  /** The message shown instead of items when there are none. */
  empty: string | null;
  now: number;
  prefs: Prefs;
  /** The favicon provider's URL template, or null when the Favicons preference is off. */
  faviconProvider: string | null;
  /** Whether items offer the Snapshot button: Browser Rendering is configured. */
  snapshotButton: boolean;
};

const SORT_LABELS: Record<ListSort, string> = {
  added_desc: "Newest",
  added_asc: "Oldest",
  title_asc: "Title A–Z",
  title_desc: "Title Z–A",
};

const pathOf = (archived: boolean) => (archived ? "/bookmarks/archived" : "/bookmarks");

export const linkTo = ({ archived, params }: Pick<Listing, "archived" | "params">): LinkTo => (changes) =>
  pageUrl(pathOf(archived), params, changes);

/** The signals the page declares: its query as the actions post it back, the page kind, and an empty selection. */
// DEBT(#28/W3): Datastar rewrites @name( even inside this JSON's string literals, so a search holding text like @Component( leaves the page's signals undeclared and its actions post without them.
const pageSignals = ({ q, sort, unread, page, archived }: Listing): string =>
  JSON.stringify({ q, sort, unread: unread ? "yes" : "", page, archived, selected: {}, selectAcross: false, bulkTags: "", action: "" });

export const BookmarkPage: FC<{ user: User } & Listing> = ({ user, ...listing }) => {
  const { archived, q, sort, unread, empty, prefs } = listing;
  const link = linkTo(listing);
  // With Unread saved as the default, turning the filter off takes an explicit empty value.
  const unreadOff = prefs.search_preferences.unread === "yes" ? "" : null;
  return (
    <Layout title={archived ? "Archived bookmarks" : "Bookmarks"} user={user} section={archived ? "archived" : "bookmarks"}>
      <SearchForm path={pathOf(archived)} q={q} sort={sort} unread={unread} link={link} />
      <p class="toolbar">
        {LIST_SORTS.map((value) => (
          <a href={link({ sort: value })} {...current(value === sort, "true")}>
            {SORT_LABELS[value]}
          </a>
        ))}
        <a href={link({ unread: unread ? unreadOff : "yes" })} {...current(unread, "true")}>
          Unread
        </a>
      </p>
      <div class="listing" data-signals={pageSignals(listing)}>
        <section>
          <BulkBar {...listing} />
          {empty && <p class="empty">{empty}</p>}
          <BookmarkList {...listing} link={link} />
          <Pagination {...listing} link={link} />
        </section>
        {prefs.collapse_side_panel && (
          <a class="sidebar-toggle" href="#sidebar">
            Show tags
          </a>
        )}
        <Sidebar {...listing} link={link} />
      </div>
    </Layout>
  );
};

/** What an action patches, concatenated: the list and the sidebar, and after a bulk action the bulk bar; Datastar morphs each by id. */
// DEBT(#28/W2): a per-item action leaves the bulk bar's item keys, the pagination nav and the empty message as first rendered, so they disagree with the list until a reload.
export const ListFragments: FC<Listing & { bulkBar: boolean }> = ({ bulkBar, ...listing }) => {
  const link = linkTo(listing);
  return (
    <>
      <BookmarkList {...listing} link={link} />
      <Sidebar {...listing} link={link} />
      {bulkBar && <BulkBar {...listing} />}
    </>
  );
};

/**
 * Submits `q` by GET to the page with the current sort and Unread filter as explicit hidden inputs, so saved
 * defaults never override them; Save posts the same two as the new defaults.
 */
const SearchForm: FC<{ path: string; q: string; sort: ListSort; unread: boolean; link: LinkTo }> = ({
  path,
  q,
  sort,
  unread,
  link,
}) => (
  <form class="search" method="get" action={path}>
    <input type="search" name="q" value={q} placeholder="Search" aria-label="Search" />
    <input type="hidden" name="sort" value={sort} />
    <input type="hidden" name="unread" value={unread ? "yes" : ""} />
    <button>Search</button>
    <button formmethod="post" formaction="/bookmarks/search-preferences">
      Save
    </button>
    <a href={link({ q: null })}>Clear</a>
  </form>
);

const post = (path: string) => `@post('${path}')`;
const itemAction = (id: number, action: ItemAction) => post(`/bookmarks/${id}/${action}`);
const bulk = (action: Action) => `$action = '${action}'; ${post("/bookmarks/bulk")}`;

/**
 * The selection controls and bulk actions. The server writes this page's item keys into the Select all handler and
 * into the expression that shows Select across once every item is selected; only integers ever land in them.
 */
const BulkBar: FC<Listing> = ({ archived, items }) => {
  const keys = items.map(({ row }) => `b${row.id}`);
  const allSelected = keys.map((key) => `$selected.${key}`).join(" && ") || "false";
  return (
    <div id="bulk-bar">
      <span aria-live="polite">
        <span data-text="Object.values($selected).filter(Boolean).length"></span> selected
      </span>
      <label>
        <input type="checkbox" data-on:change={`$selected = {${keys.map((key) => `${key}: evt.target.checked`).join(", ")}}`} />{" "}
        Select all
      </label>
      {/* Hiding leaves a bound checkbox's signal as it was, so the effect disarms Select across once the page is no longer fully selected. */}
      <label data-show={allSelected} data-effect={`(${allSelected}) || ($selectAcross = false)`}>
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
      <input type="text" data-bind="bulkTags" placeholder="tags" aria-label="Tags" autocomplete="off" />
      <button type="button" data-on:click={bulk("tag")}>
        Tag
      </button>
      <button type="button" data-on:click={bulk("untag")}>
        Untag
      </button>
    </div>
  );
};

const BookmarkList: FC<Listing & { link: LinkTo }> = ({ items, archived, link, now, prefs, faviconProvider, snapshotButton }) => (
  <ul
    id="bookmark-list"
    class={`description-${prefs.bookmark_description_display}`}
    style={`--ld-bookmark-description-max-lines: ${prefs.bookmark_description_max_lines}`}
  >
    {items.map(({ row, tags, snapshots }) => (
      <BookmarkItem
        row={row}
        tags={tags}
        snapshots={snapshots}
        archived={archived}
        link={link}
        now={now}
        prefs={prefs}
        faviconProvider={faviconProvider}
        snapshotButton={snapshotButton}
      />
    ))}
  </ul>
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

/** The heading a tag groups under alphabetically: its upper-cased first letter, or `#` for anything else. */
const letterOf = (name: string): string => {
  const first = [...name][0] ?? "";
  return /\p{L}/u.test(first) ? first.toUpperCase() : "#";
};

const Sidebar: FC<{ tags: Listing["tags"]; q: string; link: LinkTo; prefs: Prefs }> = ({ tags, q, link, prefs }) => {
  const selected = new Set(tagsIn(q));
  const groups = new Map<string, Listing["tags"]>();
  for (const tag of tags) {
    const key = prefs.tag_grouping === "alphabetical" ? letterOf(tag.name) : "";
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }
  return (
    <aside id="sidebar">
      <h2>Tags</h2>
      {[...groups].map(([letter, group]) => (
        <>
          {letter && <h4>{letter}</h4>}
          <ul>
            {group.map(({ name, count }) => {
              const on = selected.has(name.toLowerCase());
              return (
                <li class={on ? "selected" : undefined} aria-current={on ? "true" : undefined}>
                  <a href={link({ q: on ? withoutTag(q, name) || null : withTag(q, name) })}>{name}</a>{" "}
                  <span class="count">{count}</span>
                </li>
              );
            })}
          </ul>
        </>
      ))}
    </aside>
  );
};

/** One list item; the Snapshot action re-renders it alone, with `message` saying why no Snapshot was stored. */
export const BookmarkItem: FC<{
  row: BookmarkRow;
  tags: string[];
  /** How many Assets the Bookmark has, complete or not. */
  snapshots: number;
  archived: boolean;
  link: LinkTo;
  now: number;
  prefs: Prefs;
  faviconProvider: string | null;
  snapshotButton: boolean;
  message?: string;
}> = ({ row, tags, snapshots, archived, link, now, prefs, faviconProvider, snapshotButton, message }) => {
  const name = row.title || row.url;
  const description = row.description && <span class="description">{row.description}</span>;
  const tagLinks = tags.length > 0 && (
    <span class="tags">
      {tags.map((name) => (
        <a class="tag" href={link({ q: `#${name}` })}>
          #{name}
        </a>
      ))}
    </span>
  );
  const dateDisplay = prefs.bookmark_date_display;
  return (
    <li id={`bookmark-${row.id}`} class={row.unread ? "unread" : undefined}>
      <input type="checkbox" aria-label={`Select ${name}`} {...{ [`data-bind:selected.b${row.id}`]: "" }} />{" "}
      <Favicon src={faviconProvider && faviconUrl(faviconProvider, row.url)} />
      <a
        class="title"
        href={row.url}
        target={prefs.bookmark_link_target}
        rel={prefs.bookmark_link_target === "_blank" ? "noopener" : undefined}
      >
        {name}
      </a>
      {prefs.display_url && <span class="url">{row.url}</span>}
      {prefs.bookmark_description_display === "inline" ? (
        (description || tagLinks) && (
          <p class="content">
            {description} {tagLinks}
          </p>
        )
      ) : (
        <>
          {description && <p>{description}</p>}
          {tagLinks && <p>{tagLinks}</p>}
        </>
      )}
      {row.notes && (
        <details class="notes" open={prefs.permanent_notes}>
          <summary>Notes</summary>
          <pre>{row.notes}</pre>
        </details>
      )}
      {message && (
        <p class="hint" role="status">
          {message}
        </p>
      )}
      <p class="actions">
        {dateDisplay !== "hidden" && (
          <a
            class="date"
            href={
              row.latest_snapshot_id
                ? `/assets/${row.latest_snapshot_id}`
                : `https://web.archive.org/web/${archiveTimestamp(row.date_added)}/${row.url}`
            }
            title={absoluteDate(row.date_added)}
            target="_blank"
            rel="noopener"
          >
            {dateDisplay === "absolute" ? absoluteDate(row.date_added).slice(0, 10) : relativeDate(row.date_added, now)}
          </a>
        )}{" "}
        {snapshots > 0 && (
          <a class="snapshots" href={`/bookmarks/${row.id}/edit#snapshots`}>
            {`${snapshots} snapshot${snapshots === 1 ? "" : "s"}`}
          </a>
        )}{" "}
        {prefs.display_edit_bookmark_action && (
          <a class="edit" href={`/bookmarks/${row.id}/edit`} aria-label={`Edit ${name}`}>
            Edit
          </a>
        )}
        {prefs.display_archive_bookmark_action && (
          <button type="button" data-on:click={itemAction(row.id, archived ? "unarchive" : "archive")}>
            {archived ? "Unarchive" : "Archive"}
          </button>
        )}
        {prefs.display_remove_bookmark_action && (
          <button type="button" data-on:click={`confirm('Delete this bookmark?') && ${itemAction(row.id, "delete")}`}>
            Delete
          </button>
        )}
        {row.unread ? (
          <button type="button" data-on:click={itemAction(row.id, "read")}>
            Mark read
          </button>
        ) : null}
        {snapshotButton && (
          <button type="button" data-on:click={post(`/bookmarks/${row.id}/snapshot`)}>
            Snapshot
          </button>
        )}
      </p>
    </li>
  );
};

/** The site's icon from the provider, loaded by the browser; nothing when icons are off or the URL has no origin. */
const Favicon: FC<{ src: string | null }> = ({ src }) =>
  src ? <img class="favicon" src={src} alt="" width="16" height="16" loading="lazy" /> : null;
