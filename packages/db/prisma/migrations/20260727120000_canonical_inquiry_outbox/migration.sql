-- Phase 3 intentionally replaces both legacy inquiry tables. This distribution
-- has no active production data and therefore has no dual-write/backfill path.
DROP TABLE IF EXISTS "PortalInquiry";
DROP TABLE IF EXISTS "UserInquiries";

CREATE TYPE "InquirySource" AS ENUM ('PORTAL_ANONYMOUS', 'PORTAL_AUTHENTICATED');
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'READ', 'RESPONDED', 'ARCHIVED');
CREATE TYPE "InquiryDeliveryState" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'DELIVERED', 'DEAD_LETTER');

ALTER TABLE "Contact" ADD COLUMN "normalizedEmail" TEXT;
CREATE UNIQUE INDEX "Contact_accountId_normalizedEmail_key" ON "Contact"("accountId", "normalizedEmail");

CREATE TABLE "Inquiry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "userId" TEXT,
  "listingId" TEXT,
  "contactId" TEXT NOT NULL,
  "source" "InquirySource" NOT NULL,
  "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
  "visitorName" TEXT NOT NULL,
  "visitorEmail" TEXT NOT NULL,
  "visitorPhone" TEXT,
  "message" TEXT NOT NULL,
  "contactPreference" TEXT,
  "agentResponse" TEXT,
  "respondedAt" TIMESTAMP(3),
  "areaSnapshot" TEXT,
  "collectionSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InquiryDelivery" (
  "id" TEXT NOT NULL,
  "inquiryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "state" "InquiryDeliveryState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InquiryDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Inquiry_portalId_status_createdAt_idx" ON "Inquiry"("portalId", "status", "createdAt");
CREATE INDEX "Inquiry_portalId_createdAt_idx" ON "Inquiry"("portalId", "createdAt");
CREATE INDEX "Inquiry_userId_idx" ON "Inquiry"("userId");
CREATE INDEX "Inquiry_listingId_idx" ON "Inquiry"("listingId");
CREATE INDEX "Inquiry_contactId_idx" ON "Inquiry"("contactId");
CREATE INDEX "Inquiry_accountId_createdAt_idx" ON "Inquiry"("accountId", "createdAt");
CREATE UNIQUE INDEX "InquiryDelivery_idempotencyKey_key" ON "InquiryDelivery"("idempotencyKey");
CREATE INDEX "InquiryDelivery_state_nextAttemptAt_idx" ON "InquiryDelivery"("state", "nextAttemptAt");
CREATE INDEX "InquiryDelivery_inquiryId_idx" ON "InquiryDelivery"("inquiryId");
CREATE INDEX "InquiryDelivery_accountId_createdAt_idx" ON "InquiryDelivery"("accountId", "createdAt");

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InquiryDelivery" ADD CONSTRAINT "InquiryDelivery_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InquiryDelivery" ADD CONSTRAINT "InquiryDelivery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
