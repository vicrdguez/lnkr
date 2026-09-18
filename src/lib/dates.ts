const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** Each unit with the span it is used for: minutes under an hour, hours under a day, and so on. */
const UNITS: [name: string, size: number, until: number][] = [
  ["minute", MINUTE, HOUR],
  ["hour", HOUR, DAY],
  ["day", DAY, WEEK],
  ["week", WEEK, MONTH],
  ["month", MONTH, YEAR],
  ["year", YEAR, Infinity],
];

/** `just now` under a minute, otherwise whole `N <unit>s ago` in the coarsest unit that fits. */
export function relativeDate(iso: string, nowMs: number): string {
  const seconds = Math.max(0, (nowMs - Date.parse(iso)) / 1000);
  if (seconds < MINUTE) return "just now";
  const [name, size] = UNITS.find(([, , until]) => seconds < until) ?? UNITS[UNITS.length - 1];
  const n = Math.floor(seconds / size);
  return `${n} ${name}${n === 1 ? "" : "s"} ago`;
}

/** `YYYY-MM-DD HH:MM` in UTC. */
export const absoluteDate = (iso: string): string => new Date(iso).toISOString().slice(0, 16).replace("T", " ");

/** `YYYYMMDDhhmmss` in UTC, the timestamp form the Internet Archive takes in its URLs. */
export const archiveTimestamp = (iso: string): string => new Date(iso).toISOString().replace(/\D/g, "").slice(0, 14);
