// Quick Resend API key + domain validator. Safe: no emails sent.
import 'dotenv/config';
import { Resend } from 'resend';

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

console.log('RESEND_API_KEY present:', Boolean(key), key ? `(${key.slice(0, 6)}...${key.slice(-4)})` : '');
console.log('EMAIL_FROM:', from || '(unset)');

if (!key) {
  console.error('No RESEND_API_KEY — aborting.');
  process.exit(1);
}

const resend = new Resend(key);

try {
  const { data, error } = await resend.domains.list();
  if (error) {
    console.error('resend.domains.list() error:', error);
    process.exit(2);
  }
  const domains = data?.data ?? data ?? [];
  if (!domains.length) {
    console.log('No domains configured on this Resend account.');
    console.log('You can only send from onboarding@resend.dev (sandbox) to the email your Resend account was created with.');
  } else {
    console.log(`Domains on this account (${domains.length}):`);
    for (const d of domains) {
      console.log(`  - ${d.name}  region=${d.region}  status=${d.status}`);
    }
  }

  const fromDomain = from?.split('@')[1];
  if (fromDomain) {
    const match = domains.find(d => d.name === fromDomain);
    if (match) {
      console.log(`\nEMAIL_FROM domain "${fromDomain}" → status: ${match.status}`);
      if (match.status !== 'verified') {
        console.log('⚠ Not verified — sends will fail until DNS records are in place + verified in Resend.');
      } else {
        console.log('✓ Domain verified — real sends should work.');
      }
    } else {
      console.log(`\n⚠ EMAIL_FROM domain "${fromDomain}" is NOT in your Resend account.`);
      console.log('  Either: (a) add + verify the domain at https://resend.com/domains,');
      console.log('  or     (b) change EMAIL_FROM to "onboarding@resend.dev" for sandbox sends.');
    }
  }
} catch (e) {
  console.error('Failed to call Resend API:', e);
  process.exit(3);
}
