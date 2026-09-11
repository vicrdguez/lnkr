# Install as a PWA

## Why
On a phone, saving a link means sharing it. A web app manifest with a share target puts lnkr in the share sheet and on the home screen, and an OpenSearch description lets a desktop browser search lnkr from its address bar. Both are a few static routes.

## What
A manifest at `/manifest.json` with a share target that opens the new-bookmark form, an icon, an OpenSearch description at `/opensearch.xml`, and the head links that advertise them. The new-bookmark form accepts a shared URL that arrives in the `text` field, as Android sends it.

## Scope
- `GET /manifest.json`: name, short name, start URL `/bookmarks`, standalone display, theme and background colours, an SVG icon, and `share_target` as a GET to `/bookmarks/new` with `url`, `title` and `text`
- `public/static/icon.svg`
- `GET /opensearch.xml`: short name, description and a search URL template `/bookmarks?q={searchTerms}` on the Instance's origin
- Layout head: manifest link, OpenSearch link, `theme-color` meta, apple touch icon link to the SVG
- New-bookmark form: when `url` is absent and `text` is a valid URL, use it as the URL; when `url` is present, `text` is ignored
- Both routes public, no session, cacheable for a day

## Out of Scope
- A service worker or offline behaviour
- PNG icon sets and maskable icons
- Shortcuts in the manifest

## Definition of Done
- [ ] `/manifest.json` answers valid JSON with the fields listed, without a session, with `Content-Type` `application/manifest+json`.
- [ ] `/opensearch.xml` answers an OpenSearch description whose template points at the Instance origin, without a session.
- [ ] The layout links both and sets `theme-color`.
- [ ] Sharing a page whose URL arrives in `text` prefills the form's URL.

## Manual verification
- [ ] On Android Chrome, install lnkr from the browser menu, share a page from another app to lnkr and see the form prefilled.
- [ ] In Firefox desktop, add lnkr as a search engine from the address bar and search.
