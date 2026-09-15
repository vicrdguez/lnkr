/**
 * `path` with `current` minus `page`, then `changes` applied; a null change deletes the parameter.
 * `URLSearchParams` writes spaces as `+` and `#` as `%23`.
 */
export function pageUrl(path: string, current: URLSearchParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams(current);
  params.delete("page");
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Quoted phrases, with `\` taking the next character literally, and `#name` tokens as the query grammar reads them. */
const PHRASE_OR_TAG = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(\s*)#([^\s()]+)/g;

/** Lower-cased names of the `#name` tokens in `q` outside quotes. */
export function tagsIn(q: string): string[] {
  return [...q.matchAll(PHRASE_OR_TAG)].flatMap((match) => (match[2] ? [match[2].toLowerCase()] : []));
}

/** `q` with ` #name` appended. */
export const withTag = (q: string, name: string): string => `${q.trim()} #${name}`.trim();

/** `q` without its `#name` tokens in any case, each taken out with the whitespace before it. */
// DEBT(#5/A5): the scan ignores boolean structure, so removing the only tag inside parentheses leaves `( or #b)`, which no longer parses.
export function withoutTag(q: string, name: string): string {
  const wanted = name.toLowerCase();
  return q.replace(PHRASE_OR_TAG, (token, _space, tag?: string) => (tag?.toLowerCase() === wanted ? "" : token)).trim();
}
