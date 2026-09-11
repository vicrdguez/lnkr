# Tune display preferences

## Why
Every earlier slice hardcoded how the list looks and behaves: thirty per page, relative dates, links in new tabs, strict tag search. linkding lets each person set these, and the extension reads some of them from the profile. Comfort settings are what make a daily tool feel like one's own.

## What
A General section on the settings page with linkding's display and behaviour preferences, stored in the Tenant's preferences document and applied across the list, the form, the search compiler and the theme. Custom CSS served as a stylesheet. The profile endpoint reports the real values. Saved search preferences remember a sort and unread default from the list page.

## Scope
- `POST /settings/general` saving: `theme`, `bookmark_date_display`, `bookmark_description_display`, `bookmark_description_max_lines`, `bookmark_link_target`, `display_url`, `tag_search`, `tag_grouping`, `sticky_pagination`, `collapse_side_panel`, `items_per_page`, `display_edit_bookmark_action`, `display_archive_bookmark_action`, `display_remove_bookmark_action`, `default_mark_unread`, `permanent_notes`, `custom_css`
- Theme `auto`, `light`, `dark` through a `data-theme` attribute on the document and CSS variables, `auto` following `prefers-color-scheme`
- Date display `relative`, `absolute`, `hidden`; description display `inline` or `separate` with a max-lines clamp; link target `_blank` or `_self`; URL shown under the title when `display_url`
- Lax tag search: a bare term also matches a tag name exactly, regardless of case
- Tag grouping `alphabetical` groups the sidebar by first letter with a heading per letter; `disabled` keeps the flat list
- `sticky_pagination` and `collapse_side_panel` as classes the stylesheet acts on
- `items_per_page` at least 10, default 30, used by both list pages
- Action visibility flags hiding the Edit link, the Archive or Unarchive button and the Delete button per item
- `default_mark_unread` preselecting the unread checkbox on the new-bookmark form
- `permanent_notes` opening every notes element by default
- Custom CSS at `GET /custom_css` with a long cache lifetime, linked with a content hash only when non-empty
- Saved search preferences: a Save button in the list's search form storing the current `sort` and `unread` as defaults, used when the parameters are absent, and reported as `search_preferences` in the profile
- `GET /api/user/profile/` returning the stored values for its exposed fields

## Out of Scope
- Sharing defaults, `enable_sharing`, `enable_public_sharing`, `default_mark_shared`
- Favicons and auto-tagging sections, which have their own routes
- Web archive integration setting
- Any change to the API's own page size

## Definition of Done
- [ ] The General form shows every preference at its current value and saving changes them; invalid values fall back to defaults.
- [ ] Theme sets `data-theme` on the document and the stylesheet renders dark and light palettes, following the system for `auto`.
- [ ] Date display, description display and max lines, link target, URL display, action visibility and permanent notes each change the list markup as specified.
- [ ] Lax tag search makes a bare term match a tag name; strict does not.
- [ ] Alphabetical tag grouping renders letter headings in the sidebar.
- [ ] Items per page controls pagination on both list pages and rejects values under 10.
- [ ] Default mark unread preselects the checkbox on the new-bookmark form only.
- [ ] Custom CSS is served with a `text/css` type and a long cache lifetime, and the layout links it with a hash that changes when the CSS changes; an empty CSS is not linked.
- [ ] Saving search preferences stores the current sort and unread filter and the list uses them when the parameters are absent.
- [ ] The profile endpoint reports the stored theme, date display, link target, tag search, display URL, permanent notes and search preferences.

## Manual verification
- [ ] Switch theme to dark, set two description lines and inline display, and check the list in a browser; then paste `body { background: pink }` as custom CSS and reload.
