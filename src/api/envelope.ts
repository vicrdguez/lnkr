import type { Context } from "hono";

const DEFAULT_LIMIT = 100;

/** `limit` (positive, default 100) and `offset` (non-negative, default 0) from the query string. */
export function pageParams(c: Context): { limit: number; offset: number } {
  const int = (name: string, min: number, fallback: number) => {
    const value = Number(c.req.query(name) ?? NaN);
    return Number.isInteger(value) && value >= min ? value : fallback;
  };
  return { limit: int("limit", 1, DEFAULT_LIMIT), offset: int("offset", 0, 0) };
}

/** linkding's list envelope; `next` and `previous` are the request URL with `offset` moved. */
export function paginate<T>(c: Context, count: number, results: T[]) {
  const { limit, offset } = pageParams(c);
  const withOffset = (value: number) => {
    const url = new URL(c.req.url);
    if (value > 0) url.searchParams.set("offset", String(value));
    else url.searchParams.delete("offset");
    return url.href;
  };
  return {
    count,
    next: offset + limit < count ? withOffset(offset + limit) : null,
    previous: offset > 0 ? withOffset(offset - limit) : null,
    results,
  };
}
