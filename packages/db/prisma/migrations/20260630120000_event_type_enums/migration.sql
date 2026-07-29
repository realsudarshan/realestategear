DO $$ BEGIN
  CREATE TYPE "EventType" AS ENUM (
    'HOME_TOUR',
    'BUYER_CONSULTATION',
    'LISTING_CONSULTATION',
    'MEETING',
    'INSPECTION',
    'WALKTHROUGH',
    'CLOSING',
    'APPRAISAL',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "Event"
SET "type" = 'OTHER'
WHERE "type" NOT IN (
  'HOME_TOUR',
  'BUYER_CONSULTATION',
  'LISTING_CONSULTATION',
  'MEETING',
  'INSPECTION',
  'WALKTHROUGH',
  'CLOSING',
  'APPRAISAL',
  'OTHER'
);

UPDATE "TemplateEventDefinition"
SET "type" = 'OTHER'
WHERE "type" NOT IN (
  'HOME_TOUR',
  'BUYER_CONSULTATION',
  'LISTING_CONSULTATION',
  'MEETING',
  'INSPECTION',
  'WALKTHROUGH',
  'CLOSING',
  'APPRAISAL',
  'OTHER'
);

UPDATE "Event"
SET "status" = 'SCHEDULED'
WHERE "status" NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED');

UPDATE "TemplateEventDefinition"
SET "status" = 'SCHEDULED'
WHERE "status" NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Event"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "EventType" USING "type"::"EventType",
  ALTER COLUMN "status" TYPE "EventStatus" USING "status"::"EventStatus",
  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

ALTER TABLE "TemplateEventDefinition"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "EventType" USING "type"::"EventType",
  ALTER COLUMN "status" TYPE "EventStatus" USING "status"::"EventStatus",
  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
