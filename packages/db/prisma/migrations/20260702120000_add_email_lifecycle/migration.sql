-- Add opt-out state for Real Estate Gear platform lifecycle emails.
ALTER TABLE "User" ADD COLUMN "marketingEmailsOptOutAt" TIMESTAMP(3);

-- Tracks lifecycle email sends so cron jobs can be safely retried without duplicates.
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "providerId" TEXT,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_accountId_kind_key" ON "EmailDelivery"("accountId", "kind");
CREATE INDEX "EmailDelivery_userId_idx" ON "EmailDelivery"("userId");
CREATE INDEX "EmailDelivery_kind_idx" ON "EmailDelivery"("kind");
CREATE INDEX "EmailDelivery_sentAt_idx" ON "EmailDelivery"("sentAt");

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
