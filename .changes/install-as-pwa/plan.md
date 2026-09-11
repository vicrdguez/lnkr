# Install as a PWA Plan

## Approach
Two public routes returning constants, one static file, four head tags and one prefill rule. Project conventions come from `.changes/stand-up-tenant/plan.md`; the form from `.changes/edit-bookmarks-ui/plan.md`.

New and changed files:
```
src/ui/meta.ts               GET /manifest.json, GET /opensearch.xml
public/static/icon.svg
src/views/layout.tsx         head tags
src/ui/bookmark_form.tsx     text fallback
test/install-as-pwa.test.ts
```

## Implementation decisions

- **Manifest.** Built as an object and serialised: `{ name: "lnkr", short_name: "lnkr", start_url: "/bookmarks", scope: "/", display: "standalone", theme_color: "#1e1e1e", background_color: "#ffffff", icons: [{ src: "/static/icon.svg", sizes: "any", type: "image/svg+xml" }], share_target: { action: "/bookmarks/new", method: "GET", params: { url: "url", title: "title", text: "text" } } }`. Headers `Content-Type: application/manifest+json` and `Cache-Control: max-age=86400`. The route is registered before the session middleware, like `/health`.
- **OpenSearch.** A template string with the request origin from `new URL(c.req.url).origin`: `<?xml version="1.0" encoding="UTF-8"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>lnkr</ShortName><Description>Search lnkr bookmarks</Description><InputEncoding>UTF-8</InputEncoding><Image width="16" height="16" type="image/svg+xml">{origin}/static/icon.svg</Image><Url type="text/html" template="{origin}/bookmarks?q={searchTerms}"/></OpenSearchDescription>`. `Content-Type: application/opensearchdescription+xml; charset=utf-8`, same cache header, public.
- **Icon.** A simple monochrome SVG of a bookmark ribbon on a rounded square, hand-written, under two kilobytes, with `viewBox="0 0 512 512"`.
- **Head.** `Layout` adds the four tags from behavior.md; `theme-color` content is `#1e1e1e`.
- **Text fallback.** In the new-bookmark GET handler: `url = query.url || (isValidHttpUrl(query.text) ? query.text : "")`, using the API's URL validation helper. `text` is never copied into the description.
- **Tests** at the HTTP seam; `/static/icon.svg` goes through the `ASSETS` binding as in stand-up-tenant.

### Module shapes & seams

#### [NEW] Meta routes (`src/ui/meta.ts`)
```ts
export const meta: Hono<AppEnv>;   // GET /manifest.json, GET /opensearch.xml
```
Test strategy: HTTP seam.

#### [MODIFIED] Layout and new-bookmark handler
Test strategy: HTTP seam.

## Sequence
1. Manifest route and icon; scenario.
2. OpenSearch route; scenario.
3. Head tags; scenario.
4. Text fallback; scenarios.
5. Capability doc.
