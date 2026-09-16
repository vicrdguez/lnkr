import { LIST_SORTS, type ListSort } from "../db/bookmarks";

/** The list's query: the page's URL parameters, which its actions post back as signals. */
export type PageSignals = { q: string; sort: ListSort; unread: boolean; page: number };

/** `raw` read with the list page's rules, from URL strings or JSON values; anything invalid falls back to its default. */
export function parsePageSignals(raw: Record<string, unknown>): PageSignals {
  const page = Math.floor(Number(raw.page));
  return {
    q: typeof raw.q === "string" ? raw.q : "",
    sort: LIST_SORTS.find((name) => name === raw.sort) ?? "added_desc",
    unread: raw.unread === "yes",
    page: page >= 1 ? page : 1,
  };
}
