/** One Auto-tagging rule: a URL pattern whose parts each restrict the match, and the tags it adds. */
export type Rule = { host: string; path: string | null; query: URLSearchParams; fragment: string | null; tags: string[] };

/**
 * The rules of `text`, one per line as `<pattern> <tag> [<tag>...]`, the pattern being
 * `host[/path][?query][#fragment]` with an optional scheme. Blank lines, `#` comments, lines without a tag and
 * patterns that do not parse are skipped.
 */
export function parseRules(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [raw, ...tags] = trimmed.split(/\s+/);
    if (!tags.length) continue;
    const pattern = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const authority = pattern.split(/[/?#]/, 1)[0];
    if (!authority || /[\x00-\x1f\x7f@\\]/.test(authority)) continue;
    let parsed: URL;
    try {
      parsed = new URL(`https://${pattern}`);
    } catch {
      continue;
    }
    // URL normalizes dot segments, but rule paths are literal prefixes. An absent path leaves the path free.
    const path = pattern.slice(authority.length).match(/^\/[^?#]*/)?.[0] ?? null;
    rules.push({
      host: parsed.hostname.toLowerCase(),
      path,
      query: parsed.searchParams,
      fragment: parsed.hash.slice(1) || null,
      tags,
    });
  }
  return rules;
}

/** The tags of every rule matching `url`, in rule then token order, unique regardless of case; none for a bad URL. */
export function autoTags(rules: Rule[], url: string): string[] {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return [];
  }
  const input = url.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, "").replace(/[\t\n\r]/g, "");
  const path = input.match(/^[a-z][a-z0-9+.-]*:[/\\]*[^/\\?#]*([/\\][^?#]*)?/i)?.[1] ?? "/";
  const byKey = new Map<string, string>();
  for (const rule of rules) {
    if (!matches(rule, target, path)) continue;
    for (const tag of rule.tags) if (!byKey.has(tag.toLowerCase())) byKey.set(tag.toLowerCase(), tag);
  }
  return [...byKey.values()];
}

function matches(rule: Rule, url: URL, path: string): boolean {
  const host = url.hostname.toLowerCase();
  if (host !== rule.host && !host.endsWith(`.${rule.host}`)) return false;
  if (rule.path !== null && !path.startsWith(rule.path)) return false;
  for (const [key, value] of rule.query) {
    if (!url.searchParams.has(key)) return false;
    if (value && !url.searchParams.getAll(key).includes(value)) return false;
  }
  return rule.fragment === null || url.hash.slice(1).startsWith(rule.fragment);
}
