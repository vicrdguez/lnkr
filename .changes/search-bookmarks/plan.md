# Search bookmarks Plan

## Approach
One pure module, `src/search.ts`, parses a query string into a small AST and compiles it to a SQL boolean fragment with positional parameters. `listBookmarks` in `src/db/bookmarks.ts` accepts the fragment and appends it to its `WHERE` clause for both the count and the page query. The API layer only passes `q` through. Nothing else changes. Project conventions come from `.changes/stand-up-tenant/plan.md`.

## Implementation decisions

- **Grammar**, matching linkding's `search_query_parser.py` on master:
  - Tokenizer: skip whitespace; `(` and `)` are tokens; `"` or `'` opens a phrase that ends at the same unescaped quote, with `\` escaping the next character, and an unterminated phrase is a parse error; `#` followed by characters up to whitespace or a parenthesis is a tag token, and `#` alone is a parse error; `!` followed by the same is a keyword token; otherwise read a term up to whitespace or any of `( ) " ' # !`; a term equal to `and`, `or` or `not` ignoring case is an operator.
  - Parser: `expr := andExpr (OR andExpr)*`; `andExpr := notExpr (AND? notExpr)*` where a missing `AND` between two operands is adjacency; `notExpr := NOT notExpr | primary`; `primary := ( expr ) | term | phrase | tag | keyword`. Empty parentheses, a dangling operator, an operator with no left operand, and unbalanced parentheses are parse errors.
  - An empty token list is not an error and means no filter.
- **Semantics** compiled to SQL against the alias `b` of `bookmarks`:
  - term or phrase: `(instr(lower(b.title), ?) > 0 OR instr(lower(b.description), ?) > 0 OR instr(lower(b.notes), ?) > 0 OR instr(lower(b.url), ?) > 0)` with the lowercased text bound four times. `lower()` in SQLite folds ASCII only, which is the behaviour linkding has on SQLite; do not add Unicode folding.
  - `#name`: `EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)`.
  - `!unread`: `b.unread = 1`. `!untagged`: `NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id)`. Any other keyword: `1 = 1`.
  - `and`, `or`, `not` become `(... AND ...)`, `(... OR ...)`, `NOT (...)`.
  - No `LIKE` anywhere: Durable Object SQLite limits `LIKE` patterns to fifty bytes.
- **Parameter budget.** Durable Object SQLite allows one hundred bound parameters per statement. The compiler counts parameters; above ninety it returns the parse-error result, so the list endpoints answer `count` 0. Mark it `ponytail: 90-parameter budget; split the query or index with FTS5 if real queries hit it`.
- **Interface.** `compileSearch(q: string): SearchFilter | null` where `SearchFilter = { where: string; params: string[] }`. `null` means parse error. An empty or whitespace-only `q` returns `{ where: "1 = 1", params: [] }`. `parseQuery` and the AST types stay unexported.
- **Wiring.** `listBookmarks(sql, opts)` gains `search?: SearchFilter`. When present its `where` is ANDed into both the `count(*)` query and the page query with its params spliced in order after `is_archived` and before the date parameters. The API handler calls `compileSearch(q)`; on `null` it answers the envelope `{ count: 0, next: null, previous: null, results: [] }` with 200 without querying.
- **Ordering** stays `date_added DESC, id DESC`. No relevance ranking.
- **Tests** run at the HTTP seam only, seeding through the API. The Examples table in behavior.md is one parameterised test. No test imports `src/search.ts` directly.

### Module shapes & seams

#### [NEW] Search compiler (`src/search.ts`)
```ts
export type SearchFilter = { where: string; params: string[] };
export function compileSearch(q: string): SearchFilter | null;
```
Dependencies: none. Invariants: output uses only positional `?` placeholders; the text of `q` never appears in `where`; `params.length` is at most ninety. Test strategy: HTTP seam through `GET /api/bookmarks/?q=`.

#### [MODIFIED] Bookmark list query (`src/db/bookmarks.ts`)
```ts
export function listBookmarks(sql, opts: { archived: boolean; limit: number; offset: number; modifiedSince?: string; addedSince?: string; search?: SearchFilter }): { count: number; rows: BookmarkRow[] };
```

#### [MODIFIED] Bookmarks API (`src/api/bookmarks.ts`)
Reads `q`, compiles, short-circuits on `null`.

## Sequence
1. Tokenizer and parser with the term, adjacency, `and`, `or`, `not`, parentheses scenarios.
2. Phrases, tags, keywords.
3. Parse-error and parameter-budget scenarios.
4. Archived list and composition scenarios.
5. Capability doc.
