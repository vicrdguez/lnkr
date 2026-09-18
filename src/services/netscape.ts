import { decodeHTML, decodeHTMLAttribute } from "entities/decode";
import type { BookmarkInput } from "../db/bookmarks";

/** One Netscape entry: a Bookmark's writable fields and tags with the dates the file carries. */
export type Entry = BookmarkInput & { dateAdded: string; dateModified: string };

/** linkding marks Archived Bookmarks with this tag in the file; it is never stored as a Tag. */
const ARCHIVED_TAG = "linkding:bookmarks.archived";
const NOTES_OPEN = "[linkding-notes]";
const NOTES_CLOSE = "[/linkding-notes]";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ESCAPES[char]);
const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

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
      `<DT><A HREF="${escape(entry.url)}" ADD_DATE="${seconds(entry.dateAdded)}" LAST_MODIFIED="${seconds(entry.dateModified)}"` +
        ` PRIVATE="${entry.shared ? 0 : 1}" TOREAD="${entry.unread ? 1 : 0}" TAGS="${escape(tags.join(","))}">` +
        `${escape(entry.title || entry.url)}</A>`,
    );
    const notes = entry.notes ? `${NOTES_OPEN}${escape(entry.notes)}${NOTES_CLOSE}` : "";
    if (entry.description || notes) lines.push(`<DD>${escape(entry.description)}${notes}`);
  }
  lines.push("</DL><p>");
  return `${lines.join("\n")}\n`;
}

/** `seconds` since the epoch as ISO, or `fallback` when absent or not a representable time. */
function epoch(seconds: string | null, fallback: string): string {
  const time = new Date(Number(seconds) * 1000);
  return seconds && !Number.isNaN(time.getTime()) ? time.toISOString() : fallback;
}

type Options = { mapPrivateFlag: boolean; now: string };

/**
 * Every `<A>` of a Netscape file in order, with the `<DD>` that follows it; folders and other markup are ignored.
 * `now` fills a missing `ADD_DATE`, and `PRIVATE="0"` marks the entry Shared only with `mapPrivateFlag`.
 */
export async function parseNetscape(body: ReadableStream<Uint8Array> | string, options: Options): Promise<Entry[]> {
  const found: { attrs: Record<string, string>; title: string; dd: string }[] = [];
  // <DD> has no end tag, so the next <DT> is what ends its text.
  let inDd = false;
  await new HTMLRewriter()
    .on("dt", {
      element() {
        inDd = false;
      },
    })
    .on("a", {
      element(element) {
        found.push({ attrs: Object.fromEntries(element.attributes), title: "", dd: "" });
      },
      text(chunk) {
        found[found.length - 1].title += chunk.text;
      },
    })
    .on("dd", {
      element() {
        inDd = found.length > 0;
      },
      text(chunk) {
        if (inDd) found[found.length - 1].dd += chunk.text;
      },
    })
    .transform(new Response(body))
    .arrayBuffer();
  // Character references arrive encoded and possibly split across chunks, so everything is decoded once whole.
  return found.map(({ attrs, title, dd }) => {
    const attr = (name: string) => (name in attrs ? decodeHTMLAttribute(attrs[name]) : null);
    const text = decodeHTML(dd);
    const notes = /^([\s\S]*?)\[linkding-notes\]([\s\S]*)\[\/linkding-notes\]/.exec(text);
    const tags = (attr("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const dateAdded = epoch(attr("add_date"), options.now);
    return {
      url: (attr("href") ?? "").trim(),
      title: decodeHTML(title),
      description: (notes ? notes[1] : text).trimEnd(),
      notes: notes?.[2] ?? "",
      unread: attr("toread") === "1",
      is_archived: tags.includes(ARCHIVED_TAG),
      shared: options.mapPrivateFlag && attr("private") === "0",
      tags: tags.filter((tag) => tag !== ARCHIVED_TAG),
      dateAdded,
      dateModified: epoch(attr("last_modified"), dateAdded),
    };
  });
}
