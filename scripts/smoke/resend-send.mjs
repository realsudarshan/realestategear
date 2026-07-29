// End-to-end Resend send test. Sends TWO emails:
//   1. Raw sendEmail() call (proves the package wiring)
//   2. sendWelcome() (proves a real template path used in apps/api)
import 'dotenv/config';
import { sendEmail, sendWelcome } from '../../packages/email/src/EmailService.ts';

const to = process.argv[2] || process.env.TEST_EMAIL_TO;
if (!to) {
  console.error('Usage: node scripts/smoke/resend-send.mjs <to-email>');
  process.exit(1);
}

console.log(`Sending test emails to: ${to}`);
console.log(`From: ${process.env.EMAIL_FROM}`);
console.log('');

console.log('1/2  sendEmail() raw...');
const r1 = await sendEmail({
  to,
  subject: 'Real Estate Gear Resend smoke test — raw',
  html: '<h2>Raw sendEmail() test</h2><p>If you see this, <code>packages/email</code> is wired to Resend correctly.</p>',
});
console.log('     result:', r1);

console.log('');
console.log('2/2  sendWelcome() template...');
const r2 = await sendWelcome(to, 'Test User');
console.log('     result:', r2);

console.log('');
console.log('Done. Check your inbox (and spam folder) for both emails.');
