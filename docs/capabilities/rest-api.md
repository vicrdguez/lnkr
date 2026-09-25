# REST API

A client such as the linkding browser extension presents the Tenant's API token to save, look up and tag Bookmarks over linkding's REST API, so links gathered in the browser land in lnkr.

## Behaviors
- A client authenticates with one of the Tenant's API tokens, created and revoked by name on the settings page as the API tokens capability describes.
- Every `/api/` request needs `Authorization: Token <key>`; a missing token, an unknown token, or a session cookie alone is refused with linkding's error shape.
- Creating a Bookmark takes linkding's fields and Tag names and answers with linkding's document; Tag names are trimmed, deduplicated regardless of case, and created when missing. A URL that already exists updates that Bookmark instead of duplicating it.
- An empty title or description is filled from the Page metadata unless scraping is disabled; a page that cannot be fetched leaves them empty. Only `http` and `https` URLs are accepted.
- The active list and the archived list order Bookmarks newest first, page with `limit` and `offset`, filter with `modified_since` and `added_since`, and answer `count`, `next` and `previous` as absolute links.
- Both lists take linkding's search grammar in `q`, combined with the other filters. A term or quoted phrase matches a substring of the title, description, Notes or URL regardless of letter case; `#name` matches a Tag by name regardless of case and a bare term never matches a Tag; `!unread` keeps Unread Bookmarks, `!untagged` keeps Bookmarks without Tags and any other `!keyword` keeps everything.
- `and`, `or`, `not` in any letter case and parentheses combine conditions, adjacent conditions mean `and`, and `not` binds tighter than `and`, which binds tighter than `or`. A query that does not parse, or needs more than ninety bound parameters, answers `count` 0 with an empty page; an empty `q` applies no search filter.
- Both lists take `bundle=<id>` and narrow the result by that Bundle, combined with `q` and the other filters, as the Bundles capability describes; an unknown id is refused.
- A Bookmark can be read, replaced, patched, deleted, archived and unarchived by id; moving a URL onto another Bookmark's URL is refused; unknown ids answer not found.
- Checking a URL answers the existing Bookmark or null together with the page's title and description; `auto_tags` lists the Tags the Auto-tagging rules would add to it, as the Auto-tagging capability describes.
- Tags can be listed, created, read and deleted; creating an existing name in any case returns the existing Tag, and deleting a Tag removes it from its Bookmarks.
- Bundles can be listed, created, read, replaced, patched and deleted with linkding's fields, as the Bundles capability describes.
- The user profile answers linkding's fields from the Tenant's preferences, sharing and Web Archive integration disabled, and the Instance's version.
- A bare search term also matches a Tag name when the Tenant prefers lax Tag search.

## Out of scope
- Sort options and relevance ranking
- Preview images, Snapshots and Assets, Web Archive links
- Feed tokens and RSS feeds, which the feeds capability covers
- URL normalisation beyond trimming whitespace
