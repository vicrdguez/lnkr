# Tune display preferences Plan

## Approach
One typed preferences document replaces the scattered constants. `readPrefs(user)` merges the stored JSON with defaults and validates each field; every view and query that hardcoded a value now reads it from the request's user. The General form writes the document back through one route. Custom CSS and search preferences are two more fields with a route each. Project conventions come from `.changes/stand-up-tenant/plan.md`; the list from `.changes/browse-bookmarks-ui/plan.md`; the search compiler from `.changes/search-bookmarks/plan.md`.

New and changed files:
```
src/prefs.ts                   Prefs type, DEFAULT_PREFS, readPrefs(), writePrefs(), parseGeneralForm()
src/ui/settings.tsx            POST /settings/general, General section
src/ui/custom_css.ts           GET /custom_css
src/ui/bookmarks.tsx           items per page, search preference defaults, POST /bookmarks/search-preferences
src/views/layout.tsx           data-theme, custom css link, body classes
src/views/bookmark_list.tsx    date modes, description modes, link target, url, action flags, notes open, grouped sidebar
src/views/bookmark_form.tsx    default unread
src/search.ts                  compileSearch(q, { laxTags })
src/api/profile.ts             real values
public/static/style.css        light and dark palettes, clamp, sticky, collapsed
test/tune-display-preferences.test.ts
```

## Implementation decisions

- **Prefs document.** `users.prefs` JSON. `Prefs` type with defaults: `theme: "auto"`, `bookmark_date_display: "relative"`, `bookmark_description_display: "inline"`, `bookmark_description_max_lines: 1`, `bookmark_link_target: "_blank"`, `display_url: false`, `tag_search: "strict"`, `tag_grouping: "alphabetical"`, `sticky_pagination: false`, `collapse_side_panel: false`, `items_per_page: 30`, `display_edit_bookmark_action: true`, `display_archive_bookmark_action: true`, `display_remove_bookmark_action: true`, `default_mark_unread: false`, `permanent_notes: false`, `custom_css: ""`, `custom_css_hash: ""`, `search_preferences: { sort: "added_desc", shared: "off", unread: "off" }`, plus the fields other slices own: `enable_favicons`, `auto_tagging_rules`. `readPrefs` validates enumerations and integers and substitutes the default for anything invalid, so a corrupt document never breaks a page. `writePrefs` merges a partial into the current document and stores it. The General form never touches fields it does not list.
- **Form parsing.** `parseGeneralForm(form)` maps each field: enumerations must match one of the allowed values; `items_per_page` an integer at least 10; `bookmark_description_max_lines` an integer at least 1; checkboxes present means true; `custom_css` stored as submitted. Invalid values become defaults rather than errors, then 302 `/settings`.
- **Theme.** `Layout` sets `<html data-theme="<theme>">`. The stylesheet defines the light palette on `:root`, the dark palette under `[data-theme="dark"]` and, for `[data-theme="auto"]`, under `@media (prefers-color-scheme: dark)`.
- **List.** `BookmarkItem` takes `prefs`: date element omitted for `hidden`, text `absoluteDate(iso).slice(0, 10)` for `absolute`, relative otherwise, always with the tooltip and the same href; description and tags inside one `.content` element for `inline`, or `.description` then `.tags` elements for `separate`; the `ul` carries `description-inline` or `description-separate` and `style="--ld-bookmark-description-max-lines: <n>"`; the stylesheet clamps with `-webkit-line-clamp` on the description; title link `target` from the preference, `rel="noopener"` only for `_blank`; `<span class="url">` after the title when `display_url`; Edit, Archive or Unarchive, and Delete rendered only when their flag is true, Mark read unaffected; `details` gets `open` when `permanent_notes`. The `body` carries `sticky-pagination` and `side-panel-collapsed` when set; the stylesheet makes the pagination bar sticky and hides the side panel behind a toggle link that is pure CSS through `:target`.
- **Items per page.** `ITEMS_PER_PAGE` is replaced by `prefs.items_per_page` in both list pages and in `renderListFragments`. The API keeps its own `limit`.
- **Lax tag search.** `compileSearch(q, { laxTags: boolean })`; with `laxTags` a term clause gains `OR EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)` with the raw term bound once more, raising the per-term parameter count to five; the ninety-parameter budget is unchanged. Pages and the API both pass the preference.
- **Tag grouping.** The sidebar view groups `tagCounts` output by the upper-cased first character when `alphabetical`, rendering `<h4>` headings; digits and other characters group under `#`. The counts query is unchanged.
- **Default unread.** The new-bookmark form checks `unread` when `default_mark_unread` and no `unread` query parameter overrides it. The API and the edit form are untouched.
- **Custom CSS.** On save, `custom_css_hash` is the first eight hex characters of the SHA-256 of the CSS, or empty when the CSS is empty. `GET /custom_css`, session required, answers the CSS with `Content-Type: text/css; charset=utf-8` and `Cache-Control: max-age=2592000`. The layout adds `<link rel="stylesheet" href="/custom_css?v=<hash>">` after the base stylesheet when the hash is non-empty. The CSS is the user's own and is served verbatim.
- **Search preferences.** The search form gains a `Save` submit button posting to `/bookmarks/search-preferences` with the form's `sort` and `unread`; the route validates like the list page, stores `search_preferences.sort` and `.unread` (`yes` or `off`), 302 back to `/bookmarks`. The list pages use the stored values when the `sort` or `unread` parameter is absent from the query string; an explicit empty `unread=` means no filter. `shared` stays `off`.
- **Profile.** `src/api/profile.ts` reads `theme`, `bookmark_date_display`, `bookmark_link_target`, `tag_search`, `display_url`, `permanent_notes`, `search_preferences` and `enable_favicons` from prefs; `web_archive_integration`, `enable_sharing`, `enable_public_sharing` stay fixed.

### Module shapes & seams

#### [NEW] Preferences (`src/prefs.ts`)
```ts
export type Prefs = { ... as listed ... };
export const DEFAULT_PREFS: Prefs;
export function readPrefs(user: User): Prefs;
export function writePrefs(sql, userId: number, patch: Partial<Prefs>): Prefs;
export function parseGeneralForm(form: FormData): Partial<Prefs>;
```
Invariant: `readPrefs` never throws and always returns a complete, valid document. Test strategy: HTTP seam through the settings page, the list and the profile.

#### [MODIFIED] Search compiler (`src/search.ts`)
```ts
export function compileSearch(q: string, options?: { laxTags?: boolean }): SearchFilter | null;
```

#### [MODIFIED] Views, list pages, profile, stylesheet
As described. Test strategy: HTTP seam.

## Sequence
1. `src/prefs.ts`, General form, defaults and fallback scenarios.
2. Theme and layout classes.
3. List display scenarios.
4. Lax search, grouping, items per page.
5. Default unread, custom CSS, search preferences.
6. Profile.
7. Capability doc.
