-- Drop demo mode. The feature had no write path (no agent/admin UI, no API,
-- no seed) — only the consumption side was wired. Portal activation now gates
-- strictly on real matching listings via the launch checklist.
ALTER TABLE "Account" DROP COLUMN "demoMode";
ALTER TABLE "Account" DROP COLUMN "demoModeEnabledAt";
