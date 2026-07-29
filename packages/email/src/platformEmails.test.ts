import { describe, it, expect } from 'vitest';
import { buildPlatformEmail, PLATFORM_EMAIL_KINDS } from './platformEmails.js';

const TRANSACTIONAL_KINDS = [
  PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED,
  PLATFORM_EMAIL_KINDS.INTERNAL_PORTAL_LAUNCHED,
  PLATFORM_EMAIL_KINDS.INTERNAL_MLS_STATUS_FLAGGED,
];

describe('buildPlatformEmail', () => {
  it('produces a template with subject and text for every declared kind', () => {
    for (const kind of Object.values(PLATFORM_EMAIL_KINDS)) {
      const template = buildPlatformEmail(kind, { unsubscribeUrl: 'https://x.test/unsub' });
      expect(template.subject.length).toBeGreaterThan(0);
      expect(template.text.length).toBeGreaterThan(0);
    }
  });

  it('omits the unsubscribe footer for transactional kinds even when unsubscribeUrl is present', () => {
    for (const kind of TRANSACTIONAL_KINDS) {
      const template = buildPlatformEmail(kind, { unsubscribeUrl: 'https://x.test/unsub' });
      expect(template.text).not.toContain('https://x.test/unsub');
    }
  });

  it('falls back to "there" when firstName is missing', () => {
    const template = buildPlatformEmail(PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED, {});
    expect(template.text).toContain('Hey there,');
  });

  it('uses the provided firstName when present', () => {
    const template = buildPlatformEmail(PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED, { firstName: 'Jane' });
    expect(template.text).toContain('Hey Jane,');
  });
});
