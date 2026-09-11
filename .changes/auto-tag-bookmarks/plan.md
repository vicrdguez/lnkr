# Auto-tag bookmarks Plan

## Approach
One pure module turns the rules text into matches for a URL. Three callers use it: the API create path, the web form create path and `check`. The rules text lives in the existing `users.prefs` JSON, so there is no migration. Follow the project conventions in `.changes/stand-up-tenant/plan.md` and the API shapes in `.changes/serve-extension-api/`. Module names of merged slices are authoritative; the names below are the ones their plans pinned.

## Implementation decisions

- **Storage.** `prefs.auto_tagging_rules` is a string, default empty. Read with the prefs helper the earlier slices use to merge stored JSON with defaults; write by re-serialising the merged object. No new table or column.
- **Rule syntax.** Split the text on newlines. Trim each line. Skip empty lines and lines starting with `#`. Split the rest on whitespace: the first token is the pattern, the remaining tokens are tag names; a line with no tag is skipped. The pattern is parsed with `new URL("https://" + pattern)` after stripping an optional scheme: host is `hostname` lower-cased, path is `pathname` unless the pattern had no `/`, in which case there is no path constraint, query is `searchParams`, fragment is `hash` without `#`. A pattern that fails to parse is skipped.
- **Matching.** `hostname` of the URL, lower-cased, equals the rule host or ends with `.` + rule host. Path: URL `pathname` starts with the rule path, case-sensitive. Query: for every key in the rule query, the URL query must contain the key; when the rule value is non-empty the URL value must equal it. Fragment: URL fragment starts with the rule fragment when the rule has one. All constraints must hold.
- **Result order.** Tags in rule order, then token order, deduplicated case-insensitively keeping the first spelling.
- **Where tags are added.** Only when a new Bookmark row is created: the API POST path when no Bookmark with that URL exists, and the web new-bookmark form. The union of submitted and auto tags goes through the same tag-name normalisation as serve-extension-api (trim, dedupe regardless of case, create missing). An API POST that updates an existing URL, PUT, PATCH and the edit form never consult the rules.
- **check.** `auto_tags` is computed for the URL parameter on every call, bookmarked or not.
- **Form hint.** The URL check fragment of edit-bookmarks-ui gains one line, `Will be tagged: a b`, rendered only when the list is non-empty.
- **Settings.** A section "Auto tagging" with a textarea `rules`, rows 8, help text with the syntax, and a Save button posting to `/settings/auto-tagging`. The POST stores the raw text unchanged and answers 302 `/settings`.

### Module shapes & seams

#### [NEW] Auto tagging (`src/services/autotag.ts`)
```ts
export type Rule = { host: string; path: string | null; query: URLSearchParams; fragment: string | null; tags: string[] };
export function parseRules(text: string): Rule[];
export function autoTags(rules: Rule[], url: string): string[];
```
Dependencies: none. Invariants: pure; never throws on garbage input, an unparsable URL yields `[]`. Test strategy: HTTP seam through `check`, which exposes the result directly; no unit tests.

#### [MODIFIED] Bookmark creation (API and form)
The create functions in `src/api/bookmarks.ts` and `src/ui/bookmarks.tsx` call `autoTags(parseRules(prefs.auto_tagging_rules), url)` and pass the union to the tag-name normalisation before inserting. The check handler adds `auto_tags`.

#### [MODIFIED] Settings (`src/ui/settings.tsx`)
New section and POST route; reads and writes `prefs.auto_tagging_rules`.

## Sequence
1. `autotag.ts` and the `check` scenarios, matching outline included.
2. Settings section and its scenarios.
3. API create scenarios, including the existing-URL case.
4. Form create and hint scenarios.
5. Capability doc.
