-- Phase 2: Account billing — 14-day free trial + Stripe subscription state.
-- All new fields are nullable; safe additive migration. No data wipe needed.

ALTER TABLE "Account"
  ADD COLUMN "plan"                 TEXT,
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "subscriptionStatus"   TEXT,
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3);

CREATE UNIQUE INDEX "Account_stripeCustomerId_key" ON "Account"("stripeCustomerId");

-- Backfill: every account that existed BEFORE billing was a concept gets
-- plan='free'. Without this, all pre-existing accounts have plan=NULL →
-- hasActiveBilling returns false → users are immediately redirected to
-- /billing on next request. Free tier is reserved for future user-facing
-- use, but works perfectly as a "grandfathered" tier here. After this
-- migration runs, every new account is created with plan='pro' (via
-- /register-agent), so plan=NULL only ever appears on pre-billing rows.
-- Idempotency guard: only update where plan is still NULL, so re-runs
-- (migrate reset in staging) don't clobber 'pro'/'free' assignments.
UPDATE "Account" SET "plan" = 'free' WHERE "plan" IS NULL;

-- ─── ProcessedStripeEvent: idempotency for at-least-once webhook delivery ───
-- Webhook handler inserts a row keyed by Stripe's event.id before doing any
-- work; duplicate inserts hit the primary-key constraint and short-circuit
-- with a 200, so future side-effect handlers (welcome email, audit logs,
-- Slack notifications, provisioning) won't double-fire on retried events.
CREATE TABLE "ProcessedStripeEvent" (
  "id"          TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessedStripeEvent_processedAt_idx"
  ON "ProcessedStripeEvent"("processedAt");
