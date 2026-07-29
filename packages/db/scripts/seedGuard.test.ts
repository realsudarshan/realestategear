import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDatabaseTarget, requireDemoSeedOptIn } from './seedGuard.js';

const databaseUrl = 'postgresql://user:secret@localhost:5432/realestategear?schema=public';
const target = 'localhost:5432/realestategear?schema=public';

describe('seed guard', () => {
  it('derives a confirmation target without credentials', () => {
    assert.equal(getDatabaseTarget(databaseUrl), target);
  });

  it('refuses production even with a matching confirmation', () => {
    assert.throws(
      () => requireDemoSeedOptIn({ NODE_ENV: 'production', DATABASE_URL: databaseUrl, CONFIRM_DEMO_SEED: target }),
      /disabled in production/,
    );
  });

  it('requires confirmation for the exact target database', () => {
    assert.throws(() => requireDemoSeedOptIn({ NODE_ENV: 'development', DATABASE_URL: databaseUrl }), (error) => {
      assert.match((error as Error).message, /CONFIRM_DEMO_SEED=/);
      assert.ok((error as Error).message.includes(target));
      return true;
    });
    assert.throws(
      () => requireDemoSeedOptIn({ NODE_ENV: 'development', DATABASE_URL: databaseUrl, CONFIRM_DEMO_SEED: 'localhost:5432/other' }),
      /Refusing to seed/,
    );
  });

  it('allows a non-production seed for the confirmed target', () => {
    assert.equal(
      requireDemoSeedOptIn({ NODE_ENV: 'development', DATABASE_URL: databaseUrl, CONFIRM_DEMO_SEED: target }),
      target,
    );
  });
});
