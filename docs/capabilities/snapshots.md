# Snapshots

A person keeps the rendered HTML of a Bookmark's page inside lnkr, so the content survives the page disappearing and the Obsidian clipper can still clip it from the stored copy later. A Snapshot is the only kind of Asset, and it is taken by hand.

## Behaviors
- Every Bookmark on the list has a Snapshot button while the Tenant is configured for Browser Rendering: the secrets `CF_ACCOUNT_ID` and `CF_BROWSER_TOKEN`, set with `wrangler secret` in production and in `.dev.vars` locally. Without both the button is absent and the action answers that Snapshots are not configured.
- Clicking Snapshot renders the page through Cloudflare Browser Rendering, stores the HTML in the `ASSETS_BUCKET` R2 bucket under `snapshots/<bookmark id>/<asset id>.html`, and re-renders the item in place with its date now linking to the new Snapshot. A render that fails or cannot be reached leaves an Asset in `failure` status, shown as "Snapshot failed" on the item and as failed on the edit page; it is deleted and taken again by hand, never retried.
- One Snapshot every ten seconds across the Tenant, because the platform's allowance is per account: a Snapshot started sooner is refused with a message and makes no outbound request.
- The item's date links to the latest complete Snapshot when there is one and to the Web Archive otherwise, and an item with any Assets links to its edit page's Snapshots section with their count.
- The edit page lists the Bookmark's Snapshots, newest first, with date, status and size, a view link for complete ones and Delete, which asks first. Deleting removes the row and the stored file and moves the date link to the newest remaining Snapshot or back to the Web Archive.
- A stored Snapshot is served at `/assets/<id>` to the logged-in Tenant only, under `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`, so its scripts never run and it cannot reach the session cookie; unknown, pending and failed ids answer not found.
- Deleting a Bookmark, from the API, an item or the bulk bar, deletes its Assets and their stored files.
- linkding's assets API under `/api/bookmarks/<id>/assets/` lists, gets, downloads as an attachment and deletes with linkding's field names; upload answers method not allowed; a missing token answers unauthorized and unknown ids not found. `disable_html_snapshot` on bookmark creation is accepted and ignored.

## Out of scope
- Uploads of any kind, PDF snapshots, automatic snapshots on save, bulk snapshots
- Gzip storage, snapshot expiry, storage quotas, retrying failed renders in the background
- Wayback Machine saving
