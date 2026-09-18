# Feeds

A feed reader pulls a Tenant's Bookmarks over RSS with a Feed token in the URL in place of a login, so new links show up next to everything else the person reads.

## Behaviors
- The settings page shows two feed URLs, `/feeds/<token>/all` and `/feeds/<token>/unread`, carrying the Tenant's Feed token; the token is created on first view and stays the same afterwards.
- `all` lists active Bookmarks and `unread` lists active Unread ones, newest first, as an RSS 2.0 document served as `application/rss+xml`. Archived Bookmarks appear in neither.
- Each item carries the Bookmark's title, or its URL when the title is empty, its URL as link and guid, its description and when it was added as the publication date. `&`, `<`, `>` and `"` in any text are escaped.
- `q` filters either feed with the query grammar the REST API and the list page use; a query that does not parse finds nothing. `limit` caps the items, one hundred by default.
- A feed needs neither a session nor an API token. An unknown token, or a kind other than `all` and `unread`, answers not found.

## Out of scope
- A shared feed and the `user` filter
- Regenerating the Feed token
- Bundle filtering, Atom, per-item categories and enclosures
