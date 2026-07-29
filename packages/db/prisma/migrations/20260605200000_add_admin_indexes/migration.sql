-- AddIndex: Portal(accountId, isActive) for admin never_published signal
CREATE INDEX IF NOT EXISTS "Portal_accountId_isActive_idx" ON "Portal"("accountId", "isActive");

-- AddIndex: UserInquiries(portalId, createdAt) for admin no_activity signal
CREATE INDEX IF NOT EXISTS "UserInquiries_portalId_createdAt_idx" ON "UserInquiries"("portalId", "createdAt");

-- AddIndex: PortalInquiry(portalId, createdAt) for admin no_activity signal (visitor leads)
CREATE INDEX IF NOT EXISTS "PortalInquiry_portalId_createdAt_idx" ON "PortalInquiry"("portalId", "createdAt");
