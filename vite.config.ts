// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";
import {
  assertNoServiceRoleInClientEnv,
  assertStagingProjectTarget,
  assertStagingPublishableKey,
} from "./src/integrations/supabase/staging-target";

const frontendCredentialGuard: Plugin = {
  name: 'markwise-frontend-credential-guard',
  enforce: 'pre',
  config(_config, { mode }) {
    const loaded = loadEnv(mode, process.cwd(), '');
    const env = { ...loaded, ...process.env };
    assertNoServiceRoleInClientEnv(env);
    const stagingActive = env['MARKWISE_STAGING_MODE'] === 'true' || env['VITE_MARKWISE_STAGING_MODE'] === 'true';
    if (stagingActive) {
      if (env['MARKWISE_STAGING_MODE'] !== 'true' || env['VITE_MARKWISE_STAGING_MODE'] !== 'true') {
        throw new Error('Staging mode must be enabled in both server and Vite environment variables.');
      }
      assertStagingProjectTarget({
        enabled: true,
        expectedProjectRef: env['MARKWISE_EXPECTED_SUPABASE_PROJECT_REF'],
        browserExpectedProjectRef: env['VITE_MARKWISE_EXPECTED_SUPABASE_PROJECT_REF'],
        browserUrl: env['VITE_SUPABASE_URL'],
        serverUrl: env['SUPABASE_URL'],
      });
      assertStagingPublishableKey(env['VITE_SUPABASE_PUBLISHABLE_KEY']);
    }
  },
};

export default defineConfig({
  plugins: [frontendCredentialGuard],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
