// Replicates apps/api/src/server.ts env loading to verify Resend vars resolve.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const apiDir = join(projectRoot, 'apps/api');

console.log('Simulating apps/api/src/server.ts env load order:\n');
console.log(`  1. ${join(projectRoot, '.env')}`);
console.log(`  2. ${join(apiDir, '.env')}  (override: true)\n`);

dotenv.config({ path: join(projectRoot, '.env') });
dotenv.config({ path: join(apiDir, '.env'), override: true });

const mask = v => v ? `${v.slice(0, 6)}...${v.slice(-4)} (len ${v.length})` : '(unset)';

console.log('Resolved by api process:');
console.log('  RESEND_API_KEY :', mask(process.env.RESEND_API_KEY));
console.log('  EMAIL_FROM     :', process.env.EMAIL_FROM || '(unset)');
console.log('  FRONTEND_URL   :', process.env.FRONTEND_URL || '(unset)');
console.log('  DATABASE_URL   :', process.env.DATABASE_URL ? '(set)' : '(unset)');

const ok = Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM);
console.log(`\n${ok ? '✓' : '✗'} api will ${ok ? '' : 'NOT '}send real email on startup`);
process.exit(ok ? 0 : 1);
