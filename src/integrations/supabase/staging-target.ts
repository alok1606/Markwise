export const PRODUCTION_SUPABASE_PROJECT_REF = 'qqyohhpeezhrklcpfvri';

export type StagingTargetInput = {
  enabled: boolean;
  expectedProjectRef?: string | undefined;
  browserExpectedProjectRef?: string | undefined;
  browserUrl?: string | undefined;
  serverUrl?: string | undefined;
};

function projectRefFromUrl(value: string | undefined, variableName: string): string {
  if (!value) throw new Error(`Staging configuration is missing ${variableName}.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Staging configuration has an invalid ${variableName}; use the Supabase project URL.`);
  }

  const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(url.hostname);
  if (url.protocol !== 'https:' || !match?.[1]) {
    throw new Error(`Staging configuration cannot determine a project reference from ${variableName}.`);
  }
  return match[1].toLowerCase();
}

export function assertStagingProjectTarget(input: StagingTargetInput): void {
  if (!input.enabled) return;

  const expected = input.expectedProjectRef?.trim().toLowerCase();
  if (!expected) {
    throw new Error('Staging mode requires MARKWISE_EXPECTED_SUPABASE_PROJECT_REF and VITE_MARKWISE_EXPECTED_SUPABASE_PROJECT_REF.');
  }
  if (expected === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error('Staging mode cannot use the production Supabase project reference.');
  }

  const browserExpected = input.browserExpectedProjectRef?.trim().toLowerCase();
  if (!browserExpected) {
    throw new Error('Staging mode requires VITE_MARKWISE_EXPECTED_SUPABASE_PROJECT_REF.');
  }
  if (browserExpected !== expected) {
    throw new Error('Staging browser and server expected project references do not match.');
  }

  const browserRef = projectRefFromUrl(input.browserUrl, 'VITE_SUPABASE_URL');
  const serverRef = projectRefFromUrl(input.serverUrl, 'SUPABASE_URL');
  if (browserRef === PRODUCTION_SUPABASE_PROJECT_REF || serverRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error('Staging mode cannot use the production Supabase project reference.');
  }
  if (browserRef !== serverRef || browserRef !== expected) {
    throw new Error('Staging browser/server Supabase URLs do not match the expected staging project reference.');
  }
}

export function assertStagingMigrationDatabaseTarget(databaseUrl: string | undefined, expectedProjectRef: string | undefined): void {
  if (!databaseUrl) throw new Error('Staging migration configuration is missing LOVABLE_DB_MIGRATION_URL.');
  const expected = expectedProjectRef?.trim().toLowerCase();
  if (!expected) throw new Error('Staging migrations require MARKWISE_EXPECTED_SUPABASE_PROJECT_REF.');
  if (expected === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error('Staging migrations cannot use the production Supabase project reference.');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Staging migration configuration has an invalid LOVABLE_DB_MIGRATION_URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Staging migration configuration requires a PostgreSQL connection URL.');
  }
  if (url.hostname.toLowerCase() !== `db.${expected}.supabase.co`) {
    throw new Error('LOVABLE_DB_MIGRATION_URL must use the direct database host for the expected staging project.');
  }
}

function jwtRole(value: string): string | undefined {
  const payload = value.split('.')[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = atob(base64);
    return (JSON.parse(decoded) as { role?: unknown }).role as string | undefined;
  } catch {
    return undefined;
  }
}

export function assertNoServiceRoleInClientEnv(values: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!name.startsWith('VITE_') || !value) continue;
    if (value.startsWith('sb_secret_') || jwtRole(value) === 'service_role') {
      throw new Error(`Refusing to expose a service-role credential through frontend variable ${name}.`);
    }
  }
}

export function assertStagingPublishableKey(key: string | undefined): void {
  if (!key) throw new Error('Staging configuration is missing VITE_SUPABASE_PUBLISHABLE_KEY.');
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key, not a service-role credential.');
  }
}
