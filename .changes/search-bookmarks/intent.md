# Search bookmarks

## Why
A bookmark collection is only useful if a query finds the right links. The extension's omnibox search, third-party clients and the coming list page all send linkding's query syntax through `q`, so lnkr must understand exactly that grammar and match the way linkding does.

## What
A query compiler that turns linkding's search grammar into a parameterised SQL fragment, wired into the `q` parameter of both bookmark list endpoints. Terms match case-insensitive substrings of title, description, notes and URL; `#tag` matches a tag name; `!unread` and `!untagged` filter flags; `and`, `or`, `not` and parentheses combine them, with adjacency meaning `and`. A query that does not parse yields zero results, as in linkding.

## Scope
- `src/search.ts`: tokenizer, parser and SQL compiler for the grammar below
- Grammar: bare terms; phrases quoted with `"` or `'` with backslash escapes; `#name` tag conditions; `!unread` and `!untagged`; unknown `!keyword` matching everything; `and`, `or`, `not` in any letter case; parentheses; adjacency as implicit `and`
- Precedence: `not` binds tightest, then `and`, then `or`
- Term matching with `instr(lower(column), ?)` on title, description, notes and url, so any term length works within Durable Object SQLite's limits
- Tag matching by name regardless of case; strict tag search only, so a bare term never matches a tag name
- `q` on `GET /api/bookmarks/` and `GET /api/bookmarks/archived/`, combined with the existing filters by `and`
- Parse errors, and queries needing more than ninety bound parameters, answer an empty result with `count` 0
- An empty or whitespace-only `q` means no search filter

## Out of Scope
- Lax tag search, sort options, the `bundle` parameter
- Full-text indexing
- Any page in the UI
- Ranking; results stay ordered newest first

## Definition of Done
- [x] A bare term matches bookmarks whose title, description, notes or URL contains it regardless of letter case.
- [x] A quoted phrase matches as one substring including its spaces.
- [x] Adjacent terms, and terms joined with `and`, all have to match; `or` needs one side; `not` inverts; parentheses group; `not` binds tighter than `and`, which binds tighter than `or`.
- [x] `#name` matches bookmarks carrying that tag regardless of case, and a bare term never matches a tag name.
- [x] `!unread` keeps unread bookmarks, `!untagged` keeps bookmarks without tags, any other `!keyword` keeps everything.
- [x] A query that does not parse answers zero results and `count` 0 without an error status.
- [x] `q` applies to both list endpoints together with the archived split and the date filters, and pagination counts reflect the filtered set.
- [x] An empty `q` returns everything.

## Manual verification
- [ ] Type the omnibox keyword followed by a query in the browser with the extension pointed at `wrangler dev` and see matching suggestions.
