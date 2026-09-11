# Serve feeds and named tokens

## Why
Clients outside the browser need their own credentials: several devices each with an API token that can be revoked on its own, and feed readers that pull Bookmarks over RSS without a login. The single regenerable token from serve-extension-api cannot be revoked per device, and no feed exists.

## What
Named API tokens with create and revoke on the settings page, the key shown once at creation. A feed token created on demand, and RSS 2.0 feeds at `/feeds/<token>/all` and `/feeds/<token>/unread` that accept the search grammar through `q` and a `limit`.

## Scope
- Settings section "Integrations": list of API tokens with name and creation date, a form to create one with a name, a Revoke button per token; the key appears once in the response to the create POST and never again
- The Regenerate button and the always-visible token from serve-extension-api are removed; existing token rows keep working and are listed under their stored name
- Migration: `feed_tokens(key TEXT PRIMARY KEY, created TEXT NOT NULL)`
- Feed token created on first view of the settings page and shown as two feed URLs
- `GET /feeds/<token>/all` for active Bookmarks and `GET /feeds/<token>/unread` for active unread ones, newest first, as RSS 2.0 with `application/rss+xml`
- `q` on both feeds compiled by the search module; `limit` default 100
- Unknown or missing feed token answers 404; feeds need no session and no API token
- XML escaping of every text field

## Out of Scope
- A shared feed and the `user` filter, which come with share-bookmarks
- Feed token regeneration
- Bundle filtering on feeds
- Atom, per-item categories, enclosures

## Definition of Done
- [ ] The settings page lists API tokens by name and date and never shows a stored key.
- [ ] Creating a token shows its 40-character key once, and that key authenticates the API.
- [ ] Revoking a token removes it from the list and the key stops authenticating.
- [ ] The settings page shows a feed token and the two feed URLs; the token is stable across views.
- [ ] `/feeds/<token>/all` returns valid RSS 2.0 with one item per active Bookmark, newest first, with title, link, description and publication date; archived Bookmarks are absent.
- [ ] `/feeds/<token>/unread` contains only active unread Bookmarks.
- [ ] `q` filters both feeds with the search grammar and `limit` caps the items, defaulting to 100.
- [ ] A wrong token answers 404 and the feeds work without cookies.
- [ ] Titles and descriptions containing `&`, `<` or `>` are escaped in the XML.

## Manual verification
- [ ] Subscribe to the `unread` feed URL in a feed reader and see new unread Bookmarks appear.
