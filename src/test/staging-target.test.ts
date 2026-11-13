import { describe, expect, it, vi } from 'vitest';
import {
  assertNoServiceRoleInClientEnv,
  assertStagingMigrationDatabaseTarget,
  assertStagingProjectTarget,
  assertStagingPublishableKey,
} from '@/integrations/supabase/staging-target';

const goodTarget = {
  enabled: true,
  expectedProjectRef: 'staging-ref-123',
  browserExpectedProjectRef: 'staging-ref-123',
  browserUrl: 'https://staging-ref-123.supabase.co',
  serverUrl: 'https://staging-ref-123.supabase.co',
};

describe('staging Supabase target guard', () => {
  it('leaves the existing production path unchanged when staging mode is off', () => {
    expect(() => assertStagingProjectTarget({ enabled: false })).not.toThrow();
  });

  it('accepts matching staging URLs and expected reference', () => {
    expect(() => assertStagingProjectTarget(goodTarget)).not.toThrow();
  });

  it('rejects a browser/server project mismatch', () => {
    expect(() => assertStagingProjectTarget({
      ...goodTarget,
      serverUrl: 'https://another-ref.supabase.co',
    })).toThrow(/URLs do not match/);
  });

  it('rejects a missing expected project reference', () => {
    expect(() => assertStagingProjectTarget({
      ...goodTarget,
      expectedProjectRef: undefined,
    })).toThrow(/requires MARKWISE_EXPECTED_SUPABASE_PROJECT_REF/);
  });

  it('rejects the production project reference even if both URLs agree', () => {
    expect(() => assertStagingProjectTarget({
      ...goodTarget,
      expectedProjectRef: 'qqyohhpeezhrklcpfvri',
      browserExpectedProjectRef: 'qqyohhpeezhrklcpfvri',
      browserUrl: 'https://qqyohhpeezhrklcpfvri.supabase.co',
      serverUrl: 'https://qqyohhpeezhrklcpfvri.supabase.co',
    })).toThrow(/production Supabase project/);
  });

  it('requires explicit staging credentials and does not use process fallbacks', () => {
    expect(() => assertStagingProjectTarget({
      ...goodTarget,
      browserUrl: undefined,
    })).toThrow(/missing VITE_SUPABASE_URL/);
    expect(() => assertStagingPublishableKey(undefined)).toThrow(/missing VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('requires the staging project direct database host for migration tooling', () => {
    expect(() => assertStagingMigrationDatabaseTarget(
      'postgresql://user:password@db.staging-ref-123.supabase.co:5432/postgres?sslmode=require',
      'staging-ref-123',
    )).not.toThrow();
    expect(() => assertStagingMigrationDatabaseTarget(
      'postgresql://user:password@db.qqyohhpeezhrklcpfvri.supabase.co:5432/postgres',
      'staging-ref-123',
    )).toThrow(/direct database host/);
    expect(() => assertStagingMigrationDatabaseTarget(undefined, 'staging-ref-123'))
      .toThrow(/missing LOVABLE_DB_MIGRATION_URL/);
  });

  it('rejects service-role values in any frontend variable without leaking the value', () => {
    const secret = 'sb_secret_this-is-not-for-the-browser';
    let thrown: unknown;
    try {
      assertNoServiceRoleInClientEnv({ VITE_SUPABASE_SERVICE_ROLE_KEY: secret });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
    expect((thrown as Error).message).not.toContain(secret);
  });

  it('rejects legacy service-role JWT keys without logging their contents', () => {
    const payload = btoa(JSON.stringify({ role: 'service_role' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const secret = `header.${payload}.signature-secret`;
    const log = vi.spyOn(console, 'error');
    expect(() => assertStagingPublishableKey(secret)).toThrow(/not a service-role credential/);
    expect(() => assertNoServiceRoleInClientEnv({ VITE_OTHER_CREDENTIAL: secret })).toThrow(/VITE_OTHER_CREDENTIAL/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
