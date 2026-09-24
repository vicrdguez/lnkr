/** True for an absolute `http` or `https` URL, the only kind a Bookmark may hold. */
export function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
