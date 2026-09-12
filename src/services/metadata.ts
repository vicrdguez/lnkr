import pkg from "../../package.json";

export type PageMetadata = { title: string | null; description: string | null };

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 1_048_576;
const NONE: PageMetadata = { title: null, description: null };

/** Title and description of the page at `url`; nulls for anything that is not a reachable HTML page. */
export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html", "user-agent": `lnkr/${pkg.version}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return NONE;
    const found = { title: "", ogTitle: "", description: "", ogDescription: "" };
    const content = (key: keyof typeof found) => ({
      element: (element: Element) => {
        found[key] = element.getAttribute("content") ?? "";
      },
    });
    const page = new HTMLRewriter()
      .on("title", { text: (chunk) => void (found.title += chunk.text) })
      .on('meta[property="og:title"]', content("ogTitle"))
      .on('meta[name="description"]', content("description"))
      .on('meta[property="og:description"]', content("ogDescription"))
      .transform(response);
    await drain(page.body, MAX_BYTES);
    const clean = (text: string) => text.replace(/\s+/g, " ").trim() || null;
    return {
      title: clean(found.title) ?? clean(found.ogTitle),
      description: clean(found.description) ?? clean(found.ogDescription),
    };
  } catch {
    return NONE;
  }
}

/** Reads the stream so the rewriter sees it, stopping after `maxBytes`. */
async function drain(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<void> {
  if (!body) return;
  const reader = body.getReader();
  let read = 0;
  while (read < maxBytes) {
    const { done, value } = await reader.read();
    if (done) return;
    read += value.byteLength;
  }
  await reader.cancel();
}
