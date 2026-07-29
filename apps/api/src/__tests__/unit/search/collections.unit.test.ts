import { describe, it, expect } from 'vitest';

// SCHEMAS comes from the shared `search` package. Its Typesense client is lazy
// (constructed only on first use via a Proxy), so importing SCHEMAS is pure —
// no client construction, no env reads, no mock needed.
const { SCHEMAS } = await import('search/collections');

describe('Typesense SCHEMAS', () => {
  // Regression (found by deploy on 2026-06-02): declaring the reserved `id`
  // field made typesense-migrate refuse on every run — Typesense drops a
  // declared `id` (it's the auto-managed doc id), so collections().retrieve()
  // never reports it back, and the migrate script saw a permanently-missing
  // non-optional field. Do not re-add it.
  it('declares no reserved `id` field on any collection', () => {
    for (const schema of SCHEMAS) {
      const idField = schema.fields.find((f) => String(f.name) === 'id');
      expect(idField, `collection "${schema.name}" must not declare an \`id\` field`).toBeUndefined();
    }
  });

  it('default_sorting_field is an actually-declared field (Typesense requires this)', () => {
    for (const schema of SCHEMAS) {
      const names = schema.fields.map((f) => f.name);
      expect(names, schema.name).toContain(schema.default_sorting_field);
    }
  });

  it('marks Agent HQ scoped search fields as facets so Typesense can filter them', () => {
    const field = (collection: string, name: string) =>
      SCHEMAS.find((schema) => schema.name === collection)?.fields.find((f) => f.name === name) as
        | { facet?: boolean }
        | undefined;

    expect(field('contacts', 'accountId')?.facet).toBe(true);
    expect(field('transactions', 'accountId')?.facet).toBe(true);
    expect(field('transactions', 'assignedAgentId')?.facet).toBe(true);
    expect(field('tasks', 'assignedToId')?.facet).toBe(true);
  });
});
