# Serve the browser extension API

## Why
Links are gathered from the browser. The official linkding extension, the omnibox search and third-party clients all speak linkding's REST API with a token, so nothing can be saved into lnkr until that API exists with linkding's exact field names.

## What
Token authentication, the linkding-compatible endpoints for bookmarks, tags and the user profile, the `check` endpoint with page metadata and duplicate detection, and the settings section that shows the Tenant's API token and regenerates it. Bookmarks and tags get their schema. The list endpoints paginate and filter by date but do not search yet; `q` arrives with search-bookmarks.

## Scope
- Schema version 2: `bookmarks`, `tags`, `bookmark_tags`, `api_tokens`
- Settings page section "API token": shows the token, creating one on first view, and a Regenerate button that replaces it
- API authentication by `Authorization: Token <key>` only; session cookies are never accepted on `/api/`; `/api/` is exempt from CSRF
- `GET /api/bookmarks/` for active bookmarks and `GET /api/bookmarks/archived/` for archived ones, with `limit` (default 100), `offset`, `modified_since`, `added_since`, ordered newest first, wrapped in `{count, next, previous, results}` with absolute URLs
- `POST /api/bookmarks/` creating a Bookmark from `url`, `title`, `description`, `notes`, `is_archived`, `unread`, `shared`, `tag_names`; an existing URL updates that Bookmark instead; empty title or description filled from page metadata unless `disable_scraping` is present
- `GET`, `PUT`, `PATCH`, `DELETE /api/bookmarks/<id>/`
- `POST /api/bookmarks/<id>/archive/` and `/unarchive/`
- `GET /api/bookmarks/check/?url=` answering `bookmark`, `metadata` and `auto_tags`
- `GET /api/tags/`, `POST /api/tags/`, `GET /api/tags/<id>/`, `DELETE /api/tags/<id>/`
- `GET /api/user/profile/` with linkding's field names and fixed defaults
- Tag names on write: trimmed, deduplicated regardless of case, created when missing; read back ordered by name
- URL validation: must parse and use `http` or `https`
- Page metadata service: fetch with a five-second timeout and a one-megabyte read cap, parsed with `HTMLRewriter`; title from `<title>` then `og:title`, description from `meta[name=description]` then `og:description`
- Bookmark JSON with linkding's fields: `id`, `url`, `title`, `description`, `notes`, `web_archive_snapshot_url`, `favicon_url`, `preview_image_url`, `is_archived`, `unread`, `shared`, `tag_names`, `date_added`, `date_modified`
- Error bodies in linkding's shape: `{"detail": "..."}` for auth and not found, `{"<field>": ["..."]}` for validation

## Out of Scope
- The `q` search parameter and the `bundle` parameter
- Auto-tagging: `auto_tags` is always an empty list here
- Named or multiple API tokens
- Assets endpoints, favicons, preview images, Wayback
- Any bookmark page in the UI
- URL normalisation beyond trimming whitespace; duplicates are exact URL matches

## Definition of Done
- [x] The settings page shows an API token, creates one when none exists, and Regenerate replaces it so the old token stops working.
- [x] A request to `/api/` without a token answers 401 `{"detail": "Authentication credentials were not provided."}`; with an unknown token 401 `{"detail": "Invalid token."}`; with a session cookie only, 401.
- [x] Creating a Bookmark returns 201 with linkding's fields, ISO 8601 UTC timestamps, and creates missing tags.
- [x] Creating with a URL that already exists updates that Bookmark and returns 201 with the same `id`.
- [x] Creating with empty title and description fills them from the page unless `disable_scraping` is given; a page that cannot be fetched leaves them empty.
- [x] An invalid URL answers 400 `{"url": ["Enter a valid URL."]}` and creates nothing.
- [x] The active list excludes archived bookmarks and the archived list contains only them; both order newest first, honour `limit` and `offset`, and return `count`, `next` and `previous` as absolute URLs or null.
- [x] `modified_since` and `added_since` keep only bookmarks at or after the given time.
- [x] `PUT` replaces every writable field, resetting omitted ones to defaults; `PATCH` changes only the given fields; both bump `date_modified`; changing the URL to another Bookmark's URL answers 400.
- [x] `DELETE`, `archive` and `unarchive` answer 204 and take effect; unknown ids answer 404 `{"detail": "Not found."}`.
- [x] `check` returns the existing Bookmark or null, the page's title and description, and an empty `auto_tags`.
- [x] Tags list, create, get and delete work; creating an existing name returns the existing tag; deleting a tag removes it from its bookmarks.
- [x] `user/profile` returns linkding's fields with `enable_sharing` false and a `version`.
- [x] The official linkding browser extension saves, checks and tags a page against `wrangler dev`.

## Manual verification
- [ ] Install the linkding extension, point it at the dev URL with the token, save the current tab with tags, reopen the popup and see it prefilled, delete from the popup.
- [ ] Use the omnibox keyword and confirm the list endpoint is hit with `limit=5`.
