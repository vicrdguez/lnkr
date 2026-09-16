import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/web";
import type { Context, MiddlewareHandler } from "hono";

export const isDatastar = (c: Context): boolean => c.req.header("Datastar-Request") === "true";

/** Answers 400 unless the request comes from Datastar; the header also keeps other sites from calling actions. */
export const requireDatastar: MiddlewareHandler = async (c, next) =>
  isDatastar(c) ? next() : c.text("Datastar request required", 400);

/** The signals Datastar sent, from the `datastar` query parameter on GET; empty when missing or malformed. */
export async function readSignals(c: Context): Promise<Record<string, unknown>> {
  const result = await ServerSentEventGenerator.readSignals(c.req.raw);
  return result.success ? result.signals : {};
}

/** A `text/event-stream` response whose events `fn` writes; the stream closes when `fn` returns. */
export const sse = (fn: (stream: ServerSentEventGenerator) => Promise<void> | void): Response =>
  ServerSentEventGenerator.stream(fn);
