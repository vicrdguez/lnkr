# REST API

A client such as the linkding browser extension presents the Tenant's API token to save, look up and tag Bookmarks over linkding's REST API, so links gathered in the browser land in lnkr.

## Behaviors
- The settings page shows the Tenant's API token, creating one on first view; Regenerate replaces it and the old token stops working.
- Every `/api/` request needs `Authorization: Token <key>`; a missing token, an unknown token, or a session cookie alone is refused with linkding's error shape.
- Creating a Bookmark takes linkding's fields and Tag names and answers with linkding's document; Tag names are trimmed, deduplicated regardless of case, and created when missing. A URL that already exists updates that Bookmark instead of duplicating it.
- An empty title or description is filled from the Page metadata unless scraping is disabled; a page that cannot be fetched leaves them empty. Only `http` and `https` URLs are accepted.
- The active list and the archived list order Bookmarks newest first, page with `limit` and `offset`, filter with `modified_since` and `added_since`, and answer `count`, `next` and `previous` as absolute links.
- A Bookmark can be read, replaced, patched, deleted, archived and unarchived by id; moving a URL onto another Bookmark's URL is refused; unknown ids answer not found.
- Checking a URL answers the existing Bookmark or null together with the page's title and description; `auto_tags` is always empty.
- Tags can be listed, created, read and deleted; creating an existing name in any case returns the existing Tag, and deleting a Tag removes it from its Bookmarks.
- The user profile answers linkding's fields with fixed defaults, sharing disabled, and the Instance's version.

## Out of scope
- Searching with `q` and filtering by Bundle
- Auto-tagging rules, favicons, preview images, Snapshots and Assets, Web Archive links
- Named or multiple API tokens, Feed tokens
- URL normalisation beyond trimming whitespace
