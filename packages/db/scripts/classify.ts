import { runClassification } from '../classification.js';
const mode = String(process.argv[2] ?? '').toUpperCase(); const accountId = process.argv[3];
const cursor = process.argv.find((arg) => arg.startsWith('--cursor='))?.slice(9);
if (!['CHECK', 'DIFF', 'APPLY'].includes(mode) || !accountId) throw new Error('Usage: npm run classify --workspace=db -- <check|diff|apply> <accountId> [--cursor=<propertyId>]');
console.log(JSON.stringify(await runClassification({ accountId, mode: mode as 'CHECK' | 'DIFF' | 'APPLY', cursor }), null, 2));
