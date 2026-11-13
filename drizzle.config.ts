import { defineConfig } from "drizzle-kit";
import { assertStagingMigrationDatabaseTarget } from "./src/integrations/supabase/staging-target";

const stagingMode = process.env['MARKWISE_STAGING_MODE'] === 'true';
const migrationUrl = process.env['LOVABLE_DB_MIGRATION_URL'] ?? "";
if (stagingMode) {
  assertStagingMigrationDatabaseTarget(migrationUrl, process.env['MARKWISE_EXPECTED_SUPABASE_PROJECT_REF']);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: migrationUrl,
  },
});
