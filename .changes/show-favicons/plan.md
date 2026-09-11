# Show favicons Plan

## Approach
One boolean preference, one wrangler var, one line in the list item view. Nothing is fetched or stored by lnkr. Follow `.changes/stand-up-tenant/plan.md` for conventions and `.changes/browse-bookmarks-ui/plan.md` for the list view. Merged module names are authoritative.

## Implementation decisions

- **Preference.** `prefs.enable_favicons`, boolean, default false, read through the shared prefs helper. No migration.
- **Variable.** `wrangler.jsonc` `vars.LD_FAVICON_PROVIDER` set to `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url={url}&size=32`; regenerate `worker-configuration.d.ts`. The template is read from `c.env` at render time.
- **Icon URL.** `faviconUrl(template, bookmarkUrl)` returns `template.replace("{url}", encodeURIComponent(new URL(bookmarkUrl).origin))`. The origin, never the full URL, so the provider sees hosts only. A Bookmark whose URL fails to parse gets no icon.
- **Markup.** `<img class="favicon" src={...} alt="" width="16" height="16" loading="lazy">` as the first child of the list item's title line, rendered only when the preference is on. Styling in `public/static/style.css`: inline, vertical-align middle, right margin.
- **Settings.** Section "Favicons" with a checkbox `enable_favicons`, help text about the provider seeing bookmarked hosts, Save button posting to `/settings/favicons`; absent field means off. Answers 302 `/settings`.
- **Profile.** The profile handler in `src/api/profile.ts` reads `enable_favicons` from prefs instead of the fixed false.
- **API field.** `favicon_url` stays null. Nothing is stored, so there is nothing to link.

### Module shapes & seams

#### [NEW] `faviconUrl` (`src/services/favicons.ts`)
```ts
export function faviconUrl(template: string, bookmarkUrl: string): string | null;
```
Pure. Test strategy: HTTP seam through the rendered list.

#### [MODIFIED] Bookmark list view, settings router, profile handler
As described above. Test strategy: HTTP seam.

## Sequence
1. Preference default, settings section and toggle scenarios.
2. `faviconUrl` and list scenarios.
3. Profile scenario.
4. Capability doc.
