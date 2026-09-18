import { decodeHTML, decodeHTMLAttribute } from "entities/decode";
import { type BookmarkInput, type BookmarkRow, toFields } from "../db/bookmarks";

/**
 * One Netscape entry: a Bookmark's writable fields and tags with the dates the file carries. `shared` is absent when
 * the file's private flag is not mapped, so an import leaves the Bookmark's own value alone.
 */
export type Entry = Omit<BookmarkInput, "shared"> & { shared?: boolean; dateAdded: string; dateModified: string };

/** linkding marks Archived Bookmarks with this tag in the file; it is never stored as a Tag. */
const ARCHIVED_TAG = "linkding:bookmarks.archived";
const NOTES_OPEN = "[linkding-notes]";
const NOTES_CLOSE = "[/linkding-notes]";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ESCAPES[char]);
const toUnixSeconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** `seconds` since the epoch as ISO, or `fallback` when absent or not a representable time. */
function fromUnixSeconds(seconds: string | null, fallback: string): string {
  const time = new Date(Number(seconds) * 1000);
  return seconds && !Number.isNaN(time.getTime()) ? time.toISOString() : fallback;
}

/** The entry for a stored Bookmark and its tag names. */
export const entryOf = (row: BookmarkRow, tags: string[]): Entry => ({
  ...toFields(row),
  tags,
  dateAdded: row.date_added,
  dateModified: row.date_modified,
});

/** The file exactly as linkding's exporter writes it: one `<DT>` per entry, a `<DD>` only when there is text for it. */
export function renderNetscape(entries: Entry[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
  ];
  for (const entry of entries) {
    const tags = entry.is_archived ? [...entry.tags, ARCHIVED_TAG] : entry.tags;
    lines.push(
      `<DT><A HREF="${escape(entry.url)}" ADD_DATE="${toUnixSeconds(entry.dateAdded)}"` +
        ` LAST_MODIFIED="${toUnixSeconds(entry.dateModified)}" PRIVATE="${entry.shared ? 0 : 1}"` +
        ` TOREAD="${entry.unread ? 1 : 0}" TAGS="${escape(tags.join(","))}">${escape(entry.title || entry.url)}</A>`,
    );
    const notes = entry.notes ? `${NOTES_OPEN}${escape(entry.notes)}${NOTES_CLOSE}` : "";
    if (entry.description || notes) lines.push(`<DD>${escape(entry.description)}${notes}`);
  }
  lines.push("</DL><p>");
  return `${lines.join("\n")}\n`;
}

type Options = { mapPrivateFlag: boolean; now: string };
type Found = { attrs: Record<string, string>; title: string; dd: string };

/**
 * Every `<A>` of a Netscape file in order, with the `<DD>` that follows it; folders and other markup are ignored.
 * `now` fills a missing `ADD_DATE`, and `PRIVATE` sets `shared` only with `mapPrivateFlag`.
 */
export async function parseNetscape(body: ReadableStream<Uint8Array> | string, options: Options): Promise<Entry[]> {
  const found: Found[] = [];
  // <DD> has no end tag: it belongs to the <A> of the current <DT> and runs until the next <DT>. A <DT> holding a
  // folder's <H3> has no <A>, so its <DD> is dropped rather than appended to the previous entry.
  let current: Found | null = null;
  let inDd = false;
  await new HTMLRewriter()
    .on("dt", {
      element() {
        current = null;
        inDd = false;
      },
    })
    .on("a", {
      element(element) {
        current = { attrs: Object.fromEntries(element.attributes), title: "", dd: "" };
        found.push(current);
      },
      text(chunk) {
        if (current) current.title += chunk.text;
      },
    })
    .on("dd", {
      element() {
        inDd = current !== null;
      },
      text(chunk) {
        if (inDd && current) current.dd += chunk.text;
      },
    })
    .transform(new Response(body))
    // ponytail: buffers the rewritten file and every entry in memory; stream entries to the writer if files outgrow a request.
    .arrayBuffer();
  // Character references arrive encoded and possibly split across chunks, so everything is decoded once whole.
  return found.map(({ attrs, title, dd }) => {
    const attr = (name: string) => (name in attrs ? decodeHTMLAttribute(attrs[name]) : null);
    const text = decodeHTML(dd);
    const notes = /^([\s\S]*?)\[linkding-notes\]([\s\S]*)\[\/linkding-notes\]/.exec(text);
    const tags = (attr("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const dateAdded = fromUnixSeconds(attr("add_date"), options.now);
    return {
      url: (attr("href") ?? "").trim(),
      title: decodeHTML(title),
      description: (notes ? notes[1] : text).trimEnd(),
      notes: notes?.[2] ?? "",
      unread: attr("toread") === "1",
      is_archived: tags.includes(ARCHIVED_TAG),
      shared: options.mapPrivateFlag ? attr("private") === "0" : undefined,
      tags: tags.filter((tag) => tag !== ARCHIVED_TAG),
      dateAdded,
      dateModified: fromUnixSeconds(attr("last_modified"), dateAdded),
    };
  });
}
