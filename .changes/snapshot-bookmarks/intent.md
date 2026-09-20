# Snapshot bookmarks

## Why
Pages disappear before there is time to clip them into Obsidian. A Snapshot keeps the rendered HTML of a Bookmark's page inside lnkr so the content survives, and the Obsidian clipper can still clip it from the stored copy later.

## What
The assets table and an R2 bucket, a Snapshot button on every list item that renders the page through Cloudflare Browser Rendering and stores the result, a sandboxed view of each stored Snapshot, deletion from the edit page, and linkding's assets API for list, get, download and delete. Snapshots are taken by hand only; nothing happens automatically on save. A Snapshot is the only kind of Asset.

## Scope
- Schema version 4: `assets` table and `bookmarks.latest_snapshot_id`
- R2 bucket binding `ASSETS_BUCKET`; keys `snapshots/<bookmark id>/<asset id>.html`
- Secrets `CF_ACCOUNT_ID` and `CF_BROWSER_TOKEN`; the button is hidden and the action refused when either is missing
- `POST /bookmarks/<id>/snapshot` as a Datastar action: inserts a pending row, calls Browser Rendering `/content`, stores the HTML, marks the row complete or failure, and answers SSE patching that list item
- One request every ten seconds: a snapshot started less than ten seconds after the previous one is refused with a message and no outbound call
- The list item's date links to the latest completed Snapshot; each item shows its Snapshot button and, when one exists, a Snapshots link count
- Edit page section "Snapshots": one row per Asset with date, status, size, a view link and a Delete button posting to `/assets/<id>/delete`
- `GET /assets/<id>` serves the stored HTML to the logged-in Tenant with `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`
- Assets API: `GET /api/bookmarks/<id>/assets/`, `GET .../assets/<aid>/`, `GET .../assets/<aid>/download/`, `DELETE .../assets/<aid>/`, and `POST .../assets/upload/` answering 405
- Deleting a Bookmark, through the API or the UI, deletes its Assets and their R2 objects
- `disable_html_snapshot` on bookmark creation is accepted and ignored

## Out of Scope
- Uploads of any kind, PDF snapshots, automatic snapshots on save, bulk snapshots
- Gzip storage, snapshot expiry, storage quotas
- Retrying failed renders in the background; a failed Snapshot is deleted and taken again by hand
- Wayback Machine saving

## Definition of Done
- [x] A logged-in user clicks Snapshot on a list item; the page is rendered through Browser Rendering, stored, and the item re-renders with its date linking to the new Snapshot.
- [x] A render that fails or cannot be reached leaves an Asset in `failure` status, shown as failed on the item and on the edit page.
- [x] A second Snapshot started within ten seconds of the previous one is refused with a message and makes no outbound request; after ten seconds it is taken and becomes the latest.
- [x] The stored HTML is served at `/assets/<id>` only with a session, with a sandboxing Content-Security-Policy and nosniff; unknown ids answer 404.
- [x] The edit page lists a Bookmark's Snapshots with view links and Delete; deleting removes the row and the stored file and moves the date link to the newest remaining Snapshot or back to the Web Archive link.
- [x] Deleting a Bookmark removes its Snapshots and their files.
- [x] The assets API lists, gets, downloads as an attachment and deletes with linkding's field names; upload answers 405; missing token answers 401; unknown ids answer 404.
- [x] Creating a Bookmark with `disable_html_snapshot` succeeds and creates no Asset.

## Manual verification
- [ ] With real `CF_ACCOUNT_ID` and `CF_BROWSER_TOKEN` in `.dev.vars`, snapshot a JavaScript-rendered page and open it from the list; check the `X-Browser-Ms-Used` header value in the wrangler log against the 10 minutes per day Free allowance.
- [ ] Without the secrets, the Snapshot button is absent from the list and the edit page still renders.
- [ ] Open a stored Snapshot and confirm that scripts inside it do not run and that the page cannot reach the session cookie.
