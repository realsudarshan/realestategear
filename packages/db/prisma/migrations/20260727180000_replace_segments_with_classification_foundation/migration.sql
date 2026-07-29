-- DESTRUCTIVE MIGRATION: Segment and PortalSegment data is intentionally not preserved.
-- There is no active production-data compatibility requirement for this replacement.
DROP TABLE IF EXISTS "PortalSegment";
DROP TABLE IF EXISTS "Segment";

CREATE TYPE "ClassificationDecision" AS ENUM ('POSITIVE', 'NEGATIVE');
CREATE TYPE "ClassificationSource" AS ENUM ('INGESTION', 'RECLASSIFICATION', 'MANUAL');
CREATE TYPE "CollectionOverrideDecision" AS ENUM ('INCLUDE', 'EXCLUDE');
CREATE TYPE "ClassificationRunMode" AS ENUM ('CHECK', 'DIFF', 'APPLY');
CREATE TYPE "ClassificationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "Property" ADD COLUMN "normalizedAttributes" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "GeographicArea" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "definition" JSONB NOT NULL, "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ListingCollection" (
  "id" TEXT PRIMARY KEY, "portalId" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "predicate" JSONB NOT NULL, "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PropertyAreaMembership" (
  "id" TEXT PRIMARY KEY, "areaId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
  "decision" "ClassificationDecision" NOT NULL, "source" "ClassificationSource" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL, "evidence" JSONB NOT NULL, "classifierVersion" TEXT NOT NULL,
  "configHash" TEXT NOT NULL, "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PropertyClassification" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "tagSlug" TEXT NOT NULL,
  "decision" "ClassificationDecision" NOT NULL, "source" "ClassificationSource" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL, "evidence" JSONB NOT NULL, "classifierVersion" TEXT NOT NULL,
  "configHash" TEXT NOT NULL, "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CollectionManualOverride" (
  "id" TEXT PRIMARY KEY, "collectionId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
  "decision" "CollectionOverrideDecision" NOT NULL, "reason" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ClassificationRun" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "mode" "ClassificationRunMode" NOT NULL,
  "status" "ClassificationRunStatus" NOT NULL DEFAULT 'RUNNING', "configHash" TEXT NOT NULL,
  "classifierVersion" TEXT NOT NULL, "cursor" TEXT, "processed" INTEGER NOT NULL DEFAULT 0,
  "changed" INTEGER NOT NULL DEFAULT 0, "diff" JSONB, "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3)
);

ALTER TABLE "Inquiry" ADD COLUMN "areaId" TEXT, ADD COLUMN "collectionId" TEXT;
ALTER TABLE "GeographicArea" ADD CONSTRAINT "GeographicArea_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingCollection" ADD CONSTRAINT "ListingCollection_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAreaMembership" ADD CONSTRAINT "PropertyAreaMembership_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "GeographicArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyAreaMembership" ADD CONSTRAINT "PropertyAreaMembership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyClassification" ADD CONSTRAINT "PropertyClassification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyClassification" ADD CONSTRAINT "PropertyClassification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionManualOverride" ADD CONSTRAINT "CollectionManualOverride_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ListingCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionManualOverride" ADD CONSTRAINT "CollectionManualOverride_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassificationRun" ADD CONSTRAINT "ClassificationRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "GeographicArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ListingCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GeographicArea_accountId_slug_key" ON "GeographicArea"("accountId", "slug");
CREATE INDEX "GeographicArea_accountId_isPublished_position_idx" ON "GeographicArea"("accountId", "isPublished", "position");
CREATE UNIQUE INDEX "ListingCollection_portalId_slug_key" ON "ListingCollection"("portalId", "slug");
CREATE INDEX "ListingCollection_portalId_isPublished_position_idx" ON "ListingCollection"("portalId", "isPublished", "position");
CREATE UNIQUE INDEX "PropertyAreaMembership_areaId_propertyId_key" ON "PropertyAreaMembership"("areaId", "propertyId");
CREATE INDEX "PropertyAreaMembership_propertyId_decision_idx" ON "PropertyAreaMembership"("propertyId", "decision");
CREATE INDEX "PropertyAreaMembership_areaId_decision_manualOverride_idx" ON "PropertyAreaMembership"("areaId", "decision", "manualOverride");
CREATE UNIQUE INDEX "PropertyClassification_accountId_propertyId_tagSlug_key" ON "PropertyClassification"("accountId", "propertyId", "tagSlug");
CREATE INDEX "PropertyClassification_propertyId_decision_idx" ON "PropertyClassification"("propertyId", "decision");
CREATE INDEX "PropertyClassification_accountId_tagSlug_decision_manualOverride_idx" ON "PropertyClassification"("accountId", "tagSlug", "decision", "manualOverride");
CREATE UNIQUE INDEX "CollectionManualOverride_collectionId_propertyId_key" ON "CollectionManualOverride"("collectionId", "propertyId");
CREATE INDEX "CollectionManualOverride_propertyId_decision_idx" ON "CollectionManualOverride"("propertyId", "decision");
CREATE INDEX "ClassificationRun_accountId_startedAt_idx" ON "ClassificationRun"("accountId", "startedAt");
CREATE INDEX "ClassificationRun_status_startedAt_idx" ON "ClassificationRun"("status", "startedAt");
CREATE INDEX "Property_propertyType_bedrooms_bathrooms_squareFeet_idx" ON "Property"("propertyType", "bedrooms", "bathrooms", "squareFeet");
CREATE INDEX "Inquiry_areaId_idx" ON "Inquiry"("areaId");
CREATE INDEX "Inquiry_collectionId_idx" ON "Inquiry"("collectionId");
