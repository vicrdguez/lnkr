# Add and edit bookmarks in the UI Plan

## Approach
One `BookmarkForm` view serves both pages. Saving is a normal POST and redirect. Datastar handles two live behaviours only: the URL check and the tag suggestions, both GET actions answering SSE built with the official SDK. Form state lives in Datastar signals declared on the form and bound to the inputs, so the server can patch them. Project conventions come from `.changes/stand-up-tenant/plan.md`; list markup from `.changes/browse-bookmarks-ui/plan.md`; the bookmark write path and `fetchPageMetadata` from `.changes/serve-extension-api/plan.md`.

New and changed files:
```
public/static/datastar.js       Datastar 1.0.3 bundle, copied verbatim, never edited
src/datastar.ts                 isDatastar(c), requireDatastar, sse(c, fn), readSignals(c)
src/ui/bookmark_form.tsx        GET/POST /bookmarks/new, GET /bookmarks/close, GET/POST /bookmarks/:id/edit, GET /bookmarks/check, GET /bookmarks/tags/suggest
src/views/bookmark_form.tsx     BookmarkForm, UrlHint, TagSuggestions, ClosePage
src/views/layout.tsx            datastar script tag, Add bookmark link
src/views/bookmark_list.tsx     Edit link per item
src/views/settings.tsx          Bookmarklet section
src/db/bookmarks.ts             saveFromForm() reusing insert/update/setTags
src/db/tags.ts                  suggestTags(sql, prefix, exclude, limit)
test/edit-bookmarks-ui.test.ts
```

## Implementation decisions

- **Datastar.** Bundle version 1.0.3 from `https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.3/bundles/datastar.js`, committed at `public/static/datastar.js`, loaded once in the layout with `<script type="module" src="/static/datastar.js"></script>`. SDK dependency `@starfederation/datastar-sdk` 1.0.x, imported only from `@starfederation/datastar-sdk/web`; the bare import pulls Node types and must not be used.
- **`src/datastar.ts`.**
  ```ts
  export const isDatastar = (c: Context) => c.req.header("Datastar-Request") === "true";
  export const requireDatastar: MiddlewareHandler;   // 400 text "Datastar request required" when the header is absent
  export function readSignals<T>(c: Context): Promise<T>;   // ServerSentEventGenerator.readSignals(c.req.raw), GET reads the `datastar` query parameter
  export function sse(fn: (s: ServerSentEventGenerator) => Promise<void> | void): Response;  // ServerSentEventGenerator.stream(fn)
  ```
  Every action route uses `requireDatastar`, `readSignals` and returns `sse(...)` directly from the handler; Hono passes a raw `Response` through unchanged.
- **Signals and binding.** The form element carries `data-signals` with the JSON of `{ url, title, description, notes, tags, unread }` rendered by the server, and each input `data-bind:<name>`. Since JSX attribute names with dots do not parse, attributes with modifiers are written through a spread object, for example `{...{ "data-on:input__debounce.500ms": "@get('/bookmarks/check')" }}`. The URL input carries that attribute; the form carries `data-init="$url && @get('/bookmarks/check')"` so a prefilled URL is checked on load; the tags input carries `data-on:input__debounce.300ms="@get('/bookmarks/tags/suggest')"`. Signals starting with `_` are never used.
- **Check action.** `GET /bookmarks/check`, reads signals, validates `url` like the API. Invalid URL: patch `#url-hint` with an empty div, no signals. Existing Bookmark by exact URL: patch `#url-hint` with `<div id="url-hint" class="hint">This URL is already bookmarked. The form has been filled from the existing bookmark. <a href="/bookmarks/<id>/edit">Edit it</a></div>` and patch signals `{ title, description, notes, tags: names.join(" "), unread }`. Otherwise: patch an empty `#url-hint`, call `fetchPageMetadata(url)`, and patch only the keys among `title` and `description` whose signal is empty and whose metadata is non-null; when nothing qualifies send no signals event. Elements are patched in the default morph mode by id.
- **Suggest action.** `GET /bookmarks/tags/suggest`, reads `tags`, takes the last whitespace-separated token as the prefix; empty prefix patches an empty `<div id="tag-suggestions">`. `suggestTags(sql, prefix, exclude, 10)` returns names starting with the prefix ignoring case, excluding names already present as full tokens ignoring case, ordered by name ignoring case. Each suggestion renders as `<button type="button" data-on:click="$tags = '<typed text with the last token replaced by the name> '">name</button>`, with the JavaScript string escaped for single quotes and backslashes.
- **Form POST.** `application/x-www-form-urlencoded` through `hono/csrf`. Fields: `url` required and validated with the API's rule, `title`, `description`, `notes`, `tags` split on whitespace, `unread` present means true, `auto_close` present means true. New: exact-URL lookup, update that row or insert, then set tags; no metadata fetch. Edit: the URL may only equal the Bookmark's own URL or one that no other Bookmark has, otherwise 400 with the form and `A bookmark with this URL already exists.`. Validation failures re-render the form with the submitted values and status 400. Success: 302 to `/bookmarks/close` when `auto_close`, else `/bookmarks`.
- **Close page.** `/bookmarks/close` renders the layout-free page `<p>You can now close this window.</p><script>window.close()</script>`. This is the only inline script in the project.
- **Bookmarklet.** Settings section "Bookmarklet" with `<a href="javascript:window.open('<origin>/bookmarks/new?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&auto_close')">Save to lnkr</a>` where `<origin>` comes from the request URL. Rendered with JSX; the `href` string is data, not markup.
- **Auth.** All routes under `requireSession`; the actions also under `requireDatastar`. Cross-site protection for the actions comes from the required header and the `SameSite=Lax` cookie; they are GET and change nothing.
- **Tests** assert on SSE bodies as text: the `event: datastar-patch-elements` and `event: datastar-patch-signals` lines and the substrings after `data: elements ` and `data: signals ` as the SDK writes them. Signals for GET actions are sent by the test as `datastar=<JSON>` in the query string. Page HTML checks reuse the extraction helper from browse-bookmarks-ui.

### Module shapes & seams

#### [NEW] Form routes (`src/ui/bookmark_form.tsx`)
```ts
export const bookmarkForm: Hono<AppEnv>;
```
Test strategy: HTTP seam for pages and posts, SSE text for the two actions; page metadata mocked with msw.

#### [NEW] Datastar helpers (`src/datastar.ts`)
As above. Test strategy: through the two actions.

#### [MODIFIED] Tags queries (`src/db/tags.ts`)
```ts
export function suggestTags(sql, prefix: string, exclude: string[], limit: number): string[];
```

#### [MODIFIED] Bookmark queries (`src/db/bookmarks.ts`)
```ts
export function saveBookmark(sql, input: BookmarkInput, now: string, existingId?: number): BookmarkRow;  // insert or update by id, sets tags
```

## Sequence
1. Bundle, layout script tag, `src/datastar.ts`.
2. New form rendering and prefill scenarios.
3. Form POST scenarios including auto_close and the close page.
4. Check action scenarios.
5. Suggest action scenarios.
6. Edit form scenarios.
7. Bookmarklet, nav and list links.
8. Capability doc.
