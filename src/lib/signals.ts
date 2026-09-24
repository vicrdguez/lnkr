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

/** `value`, a string or number, as a positive integer when it is all digits; null otherwise. */
export const positiveInt = (value: unknown): number | null =>
  /^[1-9]\d*$/.test(String(value)) ? Number(value) : null;

/** The sort and Unread filter a list page uses when its query leaves them out. */
export type ListDefaults = Pick<PageSignals, "sort" | "unread">;
export const LIST_DEFAULTS: ListDefaults = { sort: "added_desc", unread: false };

/**
 * `raw` read with the list page's rules, from URL strings or JSON values: an absent `sort` or `unread` takes its
 * default, an explicit empty `unread` means no filter, and anything else invalid falls back to the plain default.
 */
export function parsePageSignals(raw: Record<string, unknown>, defaults: ListDefaults = LIST_DEFAULTS): PageSignals {
  return {
    q: typeof raw.q === "string" ? raw.q : "",
    sort: raw.sort === undefined ? defaults.sort : (LIST_SORTS.find((name) => name === raw.sort) ?? "added_desc"),
    unread: raw.unread === undefined ? defaults.unread : raw.unread === "yes",
    page: Math.max(parseInt(String(raw.page ?? ""), 10) || 1, 1),
    bundle: positiveInt(raw.bundle),
  };
}

/** The URL parameters of the page `signals` describe, values equal to `defaults` left out, as the page's links carry them. */
export function pageParams({ q, sort, unread, bundle }: PageSignals, defaults: ListDefaults = LIST_DEFAULTS): URLSearchParams {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== defaults.sort) params.set("sort", sort);
  if (unread !== defaults.unread) params.set("unread", unread ? "yes" : "");
  if (bundle !== null) params.set("bundle", String(bundle));
  return params;
}
