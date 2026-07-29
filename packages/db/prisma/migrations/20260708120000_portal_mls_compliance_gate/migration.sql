-- Detection: set by the daily mls-status-check cron when the roster shows an
-- account's MLS membership has gone inactive; cleared if later found active again.
ALTER TABLE "AccountMlsAccess" ADD COLUMN "flaggedInactiveAt" TIMESTAMP(3);

-- Manual admin action: set when a portal is pulled for MLS compliance.
-- Distinct from "isActive" so the public site can tell "never launched" apart
-- from "was live, suspended".
ALTER TABLE "Portal" ADD COLUMN "suspendedAt" TIMESTAMP(3);
