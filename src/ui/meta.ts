import { Hono } from "hono";
import type { AppEnv } from "../app";
import { THEME_COLOR } from "../views/layout";

const CACHE = { "cache-control": "max-age=86400" };

const MANIFEST = JSON.stringify({
  name: "lnkr",
  short_name: "lnkr",
  start_url: "/bookmarks",
  scope: "/",
  display: "standalone",
  theme_color: THEME_COLOR,
  background_color: "#ffffff",
  icons: [{ src: "/static/icon.svg", sizes: "any", type: "image/svg+xml" }],
  share_target: { action: "/bookmarks/new", method: "GET", params: { url: "url", title: "title", text: "text" } },
});

/** The web app manifest and the OpenSearch description, public constants a browser fetches without a session. */
export const meta = new Hono<AppEnv>();

meta.get("/manifest.json", (c) => c.body(MANIFEST, 200, { "content-type": "application/manifest+json", ...CACHE }));

meta.get("/opensearch.xml", (c) => {
  const origin = new URL(c.req.url).origin;
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">' +
    "<ShortName>lnkr</ShortName><Description>Search lnkr bookmarks</Description><InputEncoding>UTF-8</InputEncoding>" +
    `<Image width="16" height="16" type="image/svg+xml">${origin}/static/icon.svg</Image>` +
    `<Url type="text/html" template="${origin}/bookmarks?q={searchTerms}"/></OpenSearchDescription>`;
  return c.body(xml, 200, { "content-type": "application/opensearchdescription+xml; charset=utf-8", ...CACHE });
});
