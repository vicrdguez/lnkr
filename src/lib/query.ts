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
