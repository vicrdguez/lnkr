import { Hono } from "hono";
import type { AppEnv } from "../app";
import { deleteTag, ensureTag, getTag, listTags } from "../db/tags";
import { pageParams, paginate } from "./envelope";
import { invalid, jsonBody, notFound, parseError, tagJson } from "./serialize";

export const tags = new Hono<AppEnv>();

tags.get("/tags", (c) => {
  const { limit, offset } = pageParams(c);
  const { count, rows } = listTags(c.get("sql"), limit, offset);
  return c.json(paginate(c, count, rows.map(tagJson)));
});

tags.post("/tags", async (c) => {
  const body = await jsonBody(c);
  if (!body) return parseError(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return invalid(c, { name: ["This field is required."] });
  return c.json(tagJson(ensureTag(c.get("sql"), name, new Date().toISOString())), 201);
});

tags.get("/tags/:id", (c) => {
  const tag = getTag(c.get("sql"), Number(c.req.param("id")));
  return tag ? c.json(tagJson(tag)) : notFound(c);
});

tags.delete("/tags/:id", (c) => (deleteTag(c.get("sql"), Number(c.req.param("id"))) ? c.body(null, 204) : notFound(c)));
