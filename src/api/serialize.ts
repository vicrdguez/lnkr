import type { Context } from "hono";

export const notFound = (c: Context) => c.json({ detail: "Not found." }, 404);
