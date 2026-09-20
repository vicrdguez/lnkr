import { LIST_SORTS, type ListSort } from "../db/bookmarks";

/** The list's query: the page's URL parameters, which its actions post back as signals. */
export type PageSignals = {
  q: string;
  sort: ListSort;
  unread: boolean;
  page: number;
  /** The applied Bundle's id, null without one; whether it exists is the list's concern. */
  bundle: number | null;
};

/** `value` as a positive integer, else null. */
const positiveInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** `raw` read with the list page's rules, from URL strings or JSON values; anything invalid falls back to its default. */
export function parsePageSignals(raw: Record<string, unknown>): PageSignals {
  return {
    q: typeof raw.q === "string" ? raw.q : "",
    sort: LIST_SORTS.find((name) => name === raw.sort) ?? "added_desc",
    unread: raw.unread === "yes",
    page: Math.max(parseInt(String(raw.page ?? ""), 10) || 1, 1),
    bundle: positiveInt(raw.bundle),
  };
}

/** The URL parameters of the page `signals` describe, defaults left out, as the page's links carry them. */
export function pageParams({ q, sort, unread, bundle }: PageSignals): URLSearchParams {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== "added_desc") params.set("sort", sort);
  if (unread) params.set("unread", "yes");
  if (bundle !== null) params.set("bundle", String(bundle));
  return params;
}
