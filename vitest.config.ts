import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // The Browser Rendering secrets, so the Snapshot button renders and the action calls the mocked renderer.
      miniflare: { bindings: { CF_ACCOUNT_ID: "acc", CF_BROWSER_TOKEN: "tok" } },
    }),
  ],
  test: { setupFiles: ["test/setup.ts"] },
});
