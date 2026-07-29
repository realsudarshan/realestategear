-- CreateEnum
CREATE TYPE "PortalDomainKind" AS ENUM ('APEX', 'WWW', 'SUBDOMAIN');

-- CreateEnum
CREATE TYPE "PortalDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'SSL_PENDING', 'ACTIVE', 'FAILED', 'REMOVED');

-- CreateTable
CREATE TABLE "PortalDomain" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" "PortalDomainKind" NOT NULL,
    "status" "PortalDomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "canonical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "PortalDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalDomain_hostname_key" ON "PortalDomain"("hostname");

-- CreateIndex
CREATE INDEX "PortalDomain_portalId_idx" ON "PortalDomain"("portalId");

-- CreateIndex
CREATE INDEX "PortalDomain_status_idx" ON "PortalDomain"("status");

-- AddForeignKey
ALTER TABLE "PortalDomain" ADD CONSTRAINT "PortalDomain_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
