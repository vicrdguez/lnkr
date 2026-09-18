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
