-- Portal Launch v1 (subdivision-only scope per /autoplan reframe):
-- adds the four schema surfaces the launch needs. All changes are additive
-- with nullable / defaulted columns — backward-compatible, zero-downtime.

-- ─── Property: subdivision (MLS RESO SubdivisionName lands here) ───
-- Lives on Property, not Listing — RESO uses Listing because it has no
-- Property entity; we do. MLS ingest copies rawData.SubdivisionName here
-- on first upsert. Compound index supports the suggestions endpoint which
-- always queries subdivision scoped by city.
ALTER TABLE "Property"
  ADD COLUMN "subdivision" TEXT;

CREATE INDEX "Property_city_subdivision_idx" ON "Property"("city", "subdivision");

-- ─── Segment: subdivisions[] (mirrors cities[] / zipCodes[]) ───
-- Geographic OR-filter dimension for portal listing feeds. Empty array
-- means "don't filter on subdivision" — same semantics as cities/zipCodes.
ALTER TABLE "Segment"
  ADD COLUMN "subdivisions" TEXT[];

-- ─── Account: demoMode opt-in ───
-- Lets a portal activate without a live MLS feed. Public portal pages from
-- demo accounts must render a "Demo data" banner and emit noindex robots
-- meta (enforced in app code, not DB). Toggled by admin only.
ALTER TABLE "Account"
  ADD COLUMN "demoMode"          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "demoModeEnabledAt" TIMESTAMP(3);

-- ─── Portal: brokerage/IDX compliance + contact routing verification ───
-- brokerageName + brokeragePhone display in the portal footer per IDX
-- licensing; both required to activate. contactRoutingVerifiedAt is set
-- when the test-inquiry flow successfully delivers a routing test to the
-- agent's email (provider-ack-gated, not just send).
ALTER TABLE "Portal"
  ADD COLUMN "brokerageName"            TEXT,
  ADD COLUMN "brokeragePhone"           TEXT,
  ADD COLUMN "contactRoutingVerifiedAt" TIMESTAMP(3);
