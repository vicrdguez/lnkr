# Save bundles

## Why
The same searches get typed again and again: everything tagged for a project, everything unread about a topic. linkding calls a saved search a Bundle and puts it one click away in the side panel. lnkr has the grammar but no way to keep a query.

## What
Bundles: a name, a search, and three tag lists for any, all and excluded tags, ordered by hand. A Bundles section in the sidebar applies one with `?bundle=<id>` on both list pages, combined with whatever else is typed. Pages to list, create, edit, reorder and delete Bundles, and linkding's bundles API.

## Scope
- Migration: `bundles(id, name, search, any_tags, all_tags, excluded_tags, sort_order, date_created, date_modified)`
- `GET /bundles` list with Up and Down forms to reorder, `GET/POST /bundles/new`, `GET/POST /bundles/<id>/edit`, `POST /bundles/<id>/delete`
- Sidebar section "Bundles" on the list pages linking each to `/bookmarks?bundle=<id>` (or the archive), marking the active one, with a Clear link
- `bundle` query parameter on `/bookmarks`, `/bookmarks/archived`, `GET /api/bookmarks/` and `GET /api/bookmarks/archived/`; unknown ids answer as if absent on the pages and 400 on the API
- Composition: the Bundle's `search` compiled by the query grammar, `any_tags` needing at least one of the names, `all_tags` needing every name, `excluded_tags` rejecting any of them, all ANDed with `q` and the other filters; tag lists are whitespace-separated names matched regardless of case
- `bundle` as a page signal so per-item and bulk actions re-render the same view and select-across applies to the Bundle
- API `GET /api/bundles/`, `POST /api/bundles/`, `GET/PUT/PATCH/DELETE /api/bundles/<id>/` with fields `id`, `name`, `search`, `any_tags`, `all_tags`, `excluded_tags`, `order`, `date_created`, `date_modified`
- Name required; a new Bundle goes last unless `order` is given

## Out of Scope
- A live preview of matching bookmarks on the form
- Bundles on feeds
- Unread or shared filters stored on a Bundle
- Hiding the section through a preference

## Definition of Done
- [x] Bundles can be created, edited, deleted and reordered from the pages, and the sidebar lists them in order with the active one marked.
- [x] `?bundle=<id>` narrows both list pages by the Bundle's search and tag lists, combined with `q`, sort and the unread filter; pagination and the tag sidebar reflect the narrowed result.
- [x] `any_tags` keeps bookmarks with at least one listed tag, `all_tags` those with every listed tag, `excluded_tags` drops those with any listed tag, and `search` applies the grammar; an empty part imposes nothing.
- [x] Per-item and bulk actions on a Bundle view re-render that view, and select across applies to the Bundle's result.
- [x] The bundles API lists, creates, reads, updates and deletes with linkding's fields; `bundle` on the bookmarks API narrows the list.
- [x] Unknown Bundle ids are ignored by the pages and answer 400 on the bookmarks API and 404 on the bundles API.

## Manual verification
- [ ] Create two Bundles, reorder them, click one in the sidebar, archive an item from that view and see the view stay on the Bundle.
