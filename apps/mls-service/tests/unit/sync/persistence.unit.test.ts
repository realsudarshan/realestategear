import { describe, it, expect } from 'vitest';
import { Prisma } from 'db';
import { slugConflictFields } from '../../../src/sync/persistence.js';

function p2002(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta,
  });
}

describe('slugConflictFields', () => {
  it('reads the field list from the classic meta.target shape', () => {
    const err = p2002({ target: ['slug'] });
    expect(slugConflictFields(err)).toEqual(['slug']);
  });

  it('reads the field list from the adapter-pg nested driverAdapterError shape', () => {
    const err = p2002({
      driverAdapterError: { cause: { constraint: { fields: ['slug'] } } },
    });
    expect(slugConflictFields(err)).toEqual(['slug']);
  });

  it('returns an empty array when neither shape is present', () => {
    const err = p2002({});
    expect(slugConflictFields(err)).toEqual([]);
  });

  it('does not match a conflict on an unrelated field', () => {
    const err = p2002({ target: ['listingKey'] });
    expect(slugConflictFields(err)).not.toContain('slug');
  });
});
