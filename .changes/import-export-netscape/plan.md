# Import and export Netscape bookmarks Plan

## Approach
Export is a string built from one ordered query. Import streams the uploaded file through `HTMLRewriter`, collects one entry per `<A>` with the following `<DD>` text, then writes entries through the same create-or-update path the API uses. No new tables. Follow `.changes/stand-up-tenant/plan.md` for conventions and `.changes/serve-extension-api/` for the bookmark write path. Merged module names are authoritative.

## Implementation decisions

- **Format.** Exactly linkding's exporter output:
  ```
  <!DOCTYPE NETSCAPE-Bookmark-file-1>
  <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
  <TITLE>Bookmarks</TITLE>
  <H1>Bookmarks</H1>
  <DL><p>
  <DT><A HREF="{url}" ADD_DATE="{added}" LAST_MODIFIED="{modified}" PRIVATE="{private}" TOREAD="{toread}" TAGS="{tags}">{title}</A>
  <DD>{description}[linkding-notes]{notes}[/linkding-notes]
  </DL><p>
  ```
  Lines joined with `\n`, a trailing newline after `</DL><p>`. `{added}` and `{modified}` are `Math.floor(Date.parse(iso) / 1000)`. `{private}` is `0` for Shared else `1`. `{toread}` is `1` for Unread else `0`. `{tags}` is the tag names ordered by name joined with `,`, then `linkding:bookmarks.archived` appended for Archived. `{title}` is the title, or the URL when the title is empty. The `<DD>` line is written only when description or Notes is non-empty; the notes markers only when Notes is non-empty. Attribute values and text are HTML-escaped (`&`, `<`, `>`, `"`). Order `date_added ASC, id ASC`.
- **Export route.** `GET /settings/export`, session required, answers the text with `Content-Type: text/html; charset=utf-8` and `Content-Disposition: attachment; filename="bookmarks.html"`.
- **Import parsing.** `parseNetscape(body: ReadableStream | string): Promise<Entry[]>` runs `new HTMLRewriter().on("a", ...).on("dd", ...).transform(new Response(body))` and consumes the result. On each `<a>`: read `href`, `add_date`, `last_modified`, `private`, `toread`, `tags`; collect its text chunks as the title. On each `<dd>`: collect text chunks until the element ends and attach to the last entry. Text chunks are entity-decoded with `decodeEntities`, covering `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;` and numeric forms; attributes arrive decoded from `HTMLRewriter`. Notes are the text between `[linkding-notes]` and `[/linkding-notes]` in the `<dd>` text; the description is what precedes the marker, trimmed of trailing whitespace. `<h3>` folder names and everything else are ignored.
- **Entry to Bookmark.** `Entry = { url, title, description, notes, dateAdded, dateModified, unread, archived, shared, tags }`. `dateAdded` from `ADD_DATE` seconds as ISO, else now; `dateModified` from `LAST_MODIFIED` else `dateAdded`. `unread` is `TOREAD === "1"`. `tags` split on `,`, trimmed, non-empty; the marker tag is removed and sets `archived`. `shared` is `PRIVATE === "0"` when `map_private_flag` is on, else false. URL validity uses the same check as the API: parseable with `http` or `https`; failures are counted as skipped.
- **Writing.** Inside one `transactionSync`: for each valid entry, look up the Bookmark by exact URL. Missing: insert with the entry's fields and dates. Present: set title, description, notes, unread, archived, shared from the entry, union the tags, keep `date_added`, set `date_modified` to now. Tag names go through the shared normalisation. Counts `created`, `updated`, `skipped` are returned.
- **Import route.** `POST /settings/import`, multipart through `c.req.formData()`, `file` must be a `File` else 400; `map_private_flag` present means on. Answers 200 with the settings page carrying `{created} created, {updated} updated, {skipped} skipped`. No background work; a request may run long, which a Durable Object allows.
- **Fixture.** `test/fixtures/linkding-export.html` is authored to match the format above exactly so the round-trip scenario can compare bytes; its entries are the three in behavior.md. The round trip imports with `map_private_flag` on so the `PRIVATE="0"` entry comes back as Shared and exports as `PRIVATE="0"` again.

### Module shapes & seams

#### [NEW] Netscape (`src/services/netscape.ts`)
```ts
export type Entry = { url: string; title: string; description: string; notes: string; dateAdded: string; dateModified: string; unread: boolean; archived: boolean; shared: boolean; tags: string[] };
export function renderNetscape(bookmarks: BookmarkWithTags[]): string;
export function parseNetscape(body: ReadableStream<Uint8Array> | string, options: { mapPrivateFlag: boolean }): Promise<Entry[]>;
```
Pure apart from streaming. Invariant: `parseNetscape(renderNetscape(x))` yields entries equal to `x`. Test strategy: HTTP seam through export and import; the round-trip scenario covers the invariant.

#### [NEW] Import writer (`src/db/import.ts`)
```ts
export function importEntries(sql, entries: Entry[], now: string): { created: number; updated: number; skipped: number };
```
Dependencies: bookmark and tag query functions. Test strategy: HTTP seam.

#### [MODIFIED] Settings (`src/ui/settings.tsx`)
Export link, import form with file input and checkbox, result message.

## Sequence
1. `renderNetscape` and export scenarios.
2. `parseNetscape`, `importEntries`, import scenarios.
3. Round-trip scenario with the fixture.
4. Capability doc.
