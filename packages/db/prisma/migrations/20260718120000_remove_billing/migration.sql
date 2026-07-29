-- OSS pivot: Real Estate Gear is no longer a hosted SaaS with per-account billing.
-- Drops the Stripe subscription/trial state added in 20260529000000_account_billing
-- and the webhook-idempotency table added alongside it. Account itself is kept —
-- it's a team/organization boundary, not a billing concept.

-- DropIndex
DROP INDEX "Account_stripeCustomerId_key";

-- AlterTable
ALTER TABLE "Account"
  DROP COLUMN "currentPeriodEnd",
  DROP COLUMN "plan",
  DROP COLUMN "stripeCustomerId",
  DROP COLUMN "stripeSubscriptionId",
  DROP COLUMN "subscriptionStatus",
  DROP COLUMN "trialEndsAt";

-- DropTable
DROP TABLE "ProcessedStripeEvent";
