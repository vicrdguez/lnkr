# Tasks — snapshot-bookmarks

## Behavioral
- [ ] B1  The list item offers a Snapshot button                      → behavior.md §Take a snapshot from the list
- [ ] B2  A snapshot renders the page and stores it                   → behavior.md §Take a snapshot from the list
- [ ] B3  The date links to the latest completed snapshot             → behavior.md §Take a snapshot from the list
- [ ] B4  A failed render is recorded as failure                      → behavior.md §Take a snapshot from the list
- [ ] B5  An unreachable renderer is recorded as failure              → behavior.md §Take a snapshot from the list
- [ ] B6  A second snapshot within ten seconds is refused             → behavior.md §Take a snapshot from the list
- [ ] B7  After ten seconds a new snapshot becomes the latest         → behavior.md §Take a snapshot from the list
- [ ] B8  Snapshot without the Datastar header returns to the list    → behavior.md §Take a snapshot from the list
- [ ] B9  A snapshot is served sandboxed                              → behavior.md §View and delete snapshots
- [ ] B10 Viewing needs a session                                     → behavior.md §View and delete snapshots
- [ ] B11 Unknown asset                                               → behavior.md §View and delete snapshots
- [ ] B12 The edit page lists snapshots                               → behavior.md §View and delete snapshots
- [ ] B13 Deleting from the edit page removes the row and the file    → behavior.md §View and delete snapshots
- [ ] B14 Deleting the newest snapshot falls back to the previous one → behavior.md §View and delete snapshots
- [ ] B15 Deleting a bookmark removes its snapshots                   → behavior.md §View and delete snapshots
- [ ] B16 List assets                                                 → behavior.md §Assets API
- [ ] B17 Get one asset                                               → behavior.md §Assets API
- [ ] B18 Download sends the file as an attachment                    → behavior.md §Assets API
- [ ] B19 Delete an asset                                             → behavior.md §Assets API
- [ ] B20 Upload is not supported                                     → behavior.md §Assets API
- [ ] B21 Unknown ids                                                 → behavior.md §Assets API
- [ ] B22 Token required                                              → behavior.md §Assets API
- [ ] B23 disable_html_snapshot is accepted and ignored               → behavior.md §Creation flag from the extension

## Chores
- [ ] C1  Migration 4: assets table, index, bookmarks.latest_snapshot_id
- [ ] C2  wrangler.jsonc: ASSETS_BUCKET binding; vitest bindings for CF_ACCOUNT_ID and CF_BROWSER_TOKEN; .dev.vars.example; wrangler types
- [ ] C3  Bookmark deletion cleans up R2 objects in src/db/bookmarks.ts
- [ ] C4  Ensure list items carry id="bookmark-<id>"

## Docs
- [ ] D1  Write docs/capabilities/snapshots.md
