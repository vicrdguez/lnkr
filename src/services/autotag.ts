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
    let parsed: URL;
    try {
      parsed = new URL(`https://${pattern}`);
    } catch {
      continue;
    }
    // Without a `/` before the query or fragment the pattern leaves the path free, although URL reports `/`.
    const hasPath = /^[^?#]*\//.test(pattern);
    rules.push({
      host: parsed.hostname.toLowerCase(),
      path: hasPath ? parsed.pathname : null,
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
  const byKey = new Map<string, string>();
  for (const rule of rules) {
    if (!matches(rule, target)) continue;
    for (const tag of rule.tags) if (!byKey.has(tag.toLowerCase())) byKey.set(tag.toLowerCase(), tag);
  }
  return [...byKey.values()];
}

function matches(rule: Rule, url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host !== rule.host && !host.endsWith(`.${rule.host}`)) return false;
  if (rule.path !== null && !url.pathname.startsWith(rule.path)) return false;
  for (const [key, value] of rule.query) {
    if (!url.searchParams.has(key)) return false;
    if (value && !url.searchParams.getAll(key).includes(value)) return false;
  }
  return rule.fragment === null || url.hash.slice(1).startsWith(rule.fragment);
}
