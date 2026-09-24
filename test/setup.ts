import { reset } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { network } from "./network";

beforeAll(() => network.enable());
beforeEach(async () => {
  await reset();
  // Any outbound request a test did not mock fails.
  network.use(http.all("*", () => HttpResponse.error()));
});
afterEach(() => {
  network.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => network.disable());
