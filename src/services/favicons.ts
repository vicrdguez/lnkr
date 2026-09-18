/**
 * The provider's icon URL for a Bookmark: `{url}` in `template` becomes the Bookmark's encoded origin, never its full
 * URL, so the provider learns hosts only. Null when the Bookmark's URL does not parse.
 */
export function faviconUrl(template: string, bookmarkUrl: string): string | null {
  try {
    return template.replace("{url}", encodeURIComponent(new URL(bookmarkUrl).origin));
  } catch {
    return null;
  }
}
