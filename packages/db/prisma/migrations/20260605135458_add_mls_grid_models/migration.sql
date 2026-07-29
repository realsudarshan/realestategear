-- DropIndex
DROP INDEX "Listing_mlsBoardId_mlsId_key";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "listingKey" TEXT;

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlsAgent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "mlsId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "stateLicense" TEXT,
    "status" TEXT,
    "officeKey" TEXT,
    "officeMlsId" TEXT,
    "rawData" JSONB,
    "modifiedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlsAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlsOffice" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "mlsId" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "status" TEXT,
    "rawData" JSONB,
    "modifiedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlsOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlsSyncFailure" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlsSyncFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_providerId_resource_key" ON "SyncCursor"("providerId", "resource");

-- CreateIndex
CREATE INDEX "MlsAgent_mlsId_idx" ON "MlsAgent"("mlsId");

-- CreateIndex
CREATE INDEX "MlsAgent_email_idx" ON "MlsAgent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MlsAgent_providerId_externalId_key" ON "MlsAgent"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "MlsOffice_mlsId_idx" ON "MlsOffice"("mlsId");

-- CreateIndex
CREATE UNIQUE INDEX "MlsOffice_providerId_externalId_key" ON "MlsOffice"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "MlsSyncFailure_resource_retryCount_idx" ON "MlsSyncFailure"("resource", "retryCount");

-- CreateIndex
CREATE UNIQUE INDEX "MlsSyncFailure_providerId_resource_externalId_key" ON "MlsSyncFailure"("providerId", "resource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_listingKey_key" ON "Listing"("listingKey");

-- CreateIndex
CREATE INDEX "Listing_mlsBoardId_mlsId_idx" ON "Listing"("mlsBoardId", "mlsId");
