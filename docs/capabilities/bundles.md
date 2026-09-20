# Bundles

A person keeps a search they run again and again as a Bundle: a name, a query and three Tag lists, one click away in the sidebar of both list pages and reachable through linkding's bundles API.

## Behaviors
- A Bundle has a name, a search in the query grammar, and three whitespace-separated Tag lists: any, all and excluded. `any` keeps Bookmarks carrying at least one of the names, `all` those carrying every name, `excluded` drops those carrying any of them, and the search applies the grammar; names match regardless of case and an empty part imposes nothing. The parts are ANDed with each other and with whatever else the page or request asks: the search box, the sort, the Unread filter, the list kind.
- `/bundles` lists every Bundle in its order with a summary of its parts, Up and Down to reorder, Edit and Delete, which asks first; New bundle opens the form. The form takes the name, required, the search and the three Tag lists; saving lands back on the list. The nav shows Bundles and marks it.
- While at least one Bundle exists, the sidebar of the active list and the archive opens with a Bundles section linking each Bundle in order to the same page with `?bundle=<id>`; the applied Bundle is marked and Clear takes it off. Searching, sorting, filtering to Unread and paging keep the Bundle, and the Tag sidebar counts the narrowed result.
- Per-item and bulk actions on a Bundle view re-render that view, and Select across all pages applies to the Bundle's result.
- An unknown Bundle id on the pages is ignored, as is one deleted while its view is open.
- `GET /api/bundles/` lists, `POST /api/bundles/` creates, and `GET`, `PUT`, `PATCH` and `DELETE /api/bundles/<id>/` read, replace, patch and delete, with linkding's fields `id`, `name`, `search`, `any_tags`, `all_tags`, `excluded_tags`, `order`, `date_created` and `date_modified`. A name is required; omitted text fields are empty on create and on `PUT`; a new Bundle goes last unless `order` says where, and `order` on `PUT` or `PATCH` moves it. Unknown ids answer not found.
- `bundle=<id>` on the bookmarks API's active and archived lists narrows them by the Bundle, combined with `q` and the other filters; an unknown id is refused as `{"bundle": ["Invalid bundle."]}`.
- Positions run from 0 without gaps after every create, move and delete.

## Out of scope
- A live preview of matching Bookmarks on the form
- Bundles on feeds
- Unread or Shared filters stored on a Bundle
- Hiding the section through a preference
