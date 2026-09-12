import type { Context } from "hono";

/** String fields of a form POST; anything missing or not a string reads as "". */
export async function formFields<K extends string>(c: Context, ...names: K[]): Promise<Record<K, string>> {
  const body = await c.req.parseBody();
  const fields = {} as Record<K, string>;
  for (const name of names) {
    const value = body[name];
    fields[name] = typeof value === "string" ? value : "";
  }
  return fields;
}
