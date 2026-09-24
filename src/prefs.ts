import { LIST_SORTS, type ListSort } from "./db/bookmarks";
import { updatePrefs, type User } from "./db/users";

const THEMES = ["auto", "light", "dark"] as const;
const DATE_DISPLAYS = ["relative", "absolute", "hidden"] as const;
const DESCRIPTION_DISPLAYS = ["inline", "separate"] as const;
const LINK_TARGETS = ["_blank", "_self"] as const;
const TAG_SEARCHES = ["strict", "lax"] as const;
const TAG_GROUPINGS = ["alphabetical", "disabled"] as const;

/** The sort and Unread filter the list pages use when the query leaves them out; `shared` is always `off`. */
export type SearchPreferences = { sort: ListSort; shared: "off"; unread: "yes" | "off" };

/** The Tenant's preferences, kept as JSON in `users.prefs`; a missing or malformed field takes its default. */
export type Prefs = {
  theme: (typeof THEMES)[number];
  bookmark_date_display: (typeof DATE_DISPLAYS)[number];
  bookmark_description_display: (typeof DESCRIPTION_DISPLAYS)[number];
  bookmark_description_max_lines: number;
  bookmark_link_target: (typeof LINK_TARGETS)[number];
  display_url: boolean;
  tag_search: (typeof TAG_SEARCHES)[number];
  tag_grouping: (typeof TAG_GROUPINGS)[number];
  sticky_pagination: boolean;
  collapse_side_panel: boolean;
  items_per_page: number;
  display_edit_bookmark_action: boolean;
  display_archive_bookmark_action: boolean;
  display_remove_bookmark_action: boolean;
  default_mark_unread: boolean;
  permanent_notes: boolean;
  custom_css: string;
  /** The first eight hex digits of the SHA-256 of `custom_css`, empty when it is empty. */
  custom_css_hash: string;
  search_preferences: SearchPreferences;
  enable_favicons: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  theme: "auto",
  bookmark_date_display: "relative",
  bookmark_description_display: "inline",
  bookmark_description_max_lines: 1,
  bookmark_link_target: "_blank",
  display_url: false,
  tag_search: "strict",
  tag_grouping: "alphabetical",
  sticky_pagination: false,
  collapse_side_panel: false,
  items_per_page: 30,
  display_edit_bookmark_action: true,
  display_archive_bookmark_action: true,
  display_remove_bookmark_action: true,
  default_mark_unread: false,
  permanent_notes: false,
  custom_css: "",
  custom_css_hash: "",
  search_preferences: { sort: "added_desc", shared: "off", unread: "off" },
  enable_favicons: false,
};

/** Reads one field from JSON or form text, `fallback` when it is not valid. */
type Read<T> = (value: unknown, fallback: T) => T;

const oneOf =
  <T extends string>(values: readonly T[]): Read<T> =>
  (value, fallback) =>
    values.find((allowed) => allowed === value) ?? fallback;

/** An integer of at least `min`, as a JSON number or as decimal digits. */
const intAtLeast =
  (min: number): Read<number> =>
  (value, fallback) => {
    const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
    return Number.isInteger(n) && n >= min ? n : fallback;
  };

const bool: Read<boolean> = (value, fallback) => (typeof value === "boolean" ? value : fallback);
const str: Read<string> = (value, fallback) => (typeof value === "string" ? value : fallback);

const searchPreferences: Read<SearchPreferences> = (value, fallback) => {
  const doc = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { sort: oneOf(LIST_SORTS)(doc.sort, fallback.sort), shared: "off", unread: oneOf(["yes", "off"] as const)(doc.unread, fallback.unread) };
};

const READERS: { [K in keyof Prefs]: Read<Prefs[K]> } = {
  theme: oneOf(THEMES),
  bookmark_date_display: oneOf(DATE_DISPLAYS),
  bookmark_description_display: oneOf(DESCRIPTION_DISPLAYS),
  bookmark_description_max_lines: intAtLeast(1),
  bookmark_link_target: oneOf(LINK_TARGETS),
  display_url: bool,
  tag_search: oneOf(TAG_SEARCHES),
  tag_grouping: oneOf(TAG_GROUPINGS),
  sticky_pagination: bool,
  collapse_side_panel: bool,
  items_per_page: intAtLeast(10),
  display_edit_bookmark_action: bool,
  display_archive_bookmark_action: bool,
  display_remove_bookmark_action: bool,
  default_mark_unread: bool,
  permanent_notes: bool,
  custom_css: str,
  custom_css_hash: str,
  search_preferences: searchPreferences,
  enable_favicons: bool,
};

const read = <K extends keyof Prefs>(key: K, value: unknown): Prefs[K] => READERS[key](value, DEFAULT_PREFS[key]);

/** The Tenant's complete, valid preferences; never throws, and a document that does not parse counts as empty. */
export function readPrefs(user: User): Prefs {
  const doc = stored(user.prefs);
  const prefs = {} as Record<keyof Prefs, unknown>;
  for (const key of Object.keys(READERS) as (keyof Prefs)[]) prefs[key] = read(key, doc[key]);
  return prefs as Prefs;
}

/** Stores `patch` over the user's current document, keeping fields this version does not know. */
export function writePrefs(sql: SqlStorage, user: User, patch: Partial<Prefs>): void {
  updatePrefs(sql, user.id, JSON.stringify({ ...stored(user.prefs), ...patch }));
}

/** The fields the General settings form edits, in the order it shows them. */
export const GENERAL_FIELDS = [
  "theme",
  "bookmark_date_display",
  "bookmark_description_display",
  "bookmark_description_max_lines",
  "bookmark_link_target",
  "display_url",
  "tag_search",
  "tag_grouping",
  "sticky_pagination",
  "collapse_side_panel",
  "items_per_page",
  "display_edit_bookmark_action",
  "display_archive_bookmark_action",
  "display_remove_bookmark_action",
  "default_mark_unread",
  "permanent_notes",
  "custom_css",
] as const satisfies readonly (keyof Prefs)[];

/** The General form's fields: a checkbox is true when present, anything else invalid takes its default. */
export function parseGeneralForm(form: Record<string, unknown>): Partial<Prefs> {
  const patch: Record<string, unknown> = {};
  for (const key of GENERAL_FIELDS) patch[key] = typeof DEFAULT_PREFS[key] === "boolean" ? key in form : read(key, form[key]);
  return patch as Partial<Prefs>;
}

/** The search form's `sort` and `unread` as saved search preferences; invalid values take their defaults. */
export const parseSearchPreferences = ({ sort, unread }: Record<string, unknown>): SearchPreferences =>
  read("search_preferences", { sort, unread });

/** The allowed values of each enumerated preference, as the General form offers them. */
export const CHOICES = {
  theme: THEMES,
  bookmark_date_display: DATE_DISPLAYS,
  bookmark_description_display: DESCRIPTION_DISPLAYS,
  bookmark_link_target: LINK_TARGETS,
  tag_search: TAG_SEARCHES,
  tag_grouping: TAG_GROUPINGS,
} as const;

function stored(json: string): Record<string, unknown> {
  try {
    const doc: unknown = JSON.parse(json);
    return doc && typeof doc === "object" ? (doc as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
