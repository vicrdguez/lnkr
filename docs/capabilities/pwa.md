# Install as a PWA

A person installs lnkr on a phone's home screen and shares links to it from other apps, or adds it to a desktop browser as a search engine.

## Behaviors
- `GET /manifest.json` answers the web app manifest without a session: name and short name `lnkr`, start URL `/bookmarks`, standalone display, theme and background colours, and an SVG icon at `/static/icon.svg`. It is cacheable for a day.
- The manifest's share target opens the new-bookmark form with a GET carrying `url`, `title` and `text`.
- `GET /opensearch.xml` answers an OpenSearch description without a session, whose search URL is `/bookmarks?q={searchTerms}` on the origin the request arrived at. It is cacheable for a day.
- Every page's head links the manifest and the OpenSearch description, sets `theme-color`, and names the SVG as the apple touch icon.
- The new-bookmark form takes its URL from `text` when `url` is absent and `text` is an `http` or `https` URL, as Android shares one. Any other `text` is ignored, and a present `url` always wins.

## Out of scope
- A service worker or offline use
- PNG icon sets, maskable icons and manifest shortcuts
