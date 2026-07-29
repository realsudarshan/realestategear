-- Link notes directly to calendar/CRM events so event dialogs can show a durable note stream.
ALTER TABLE "Note" ADD COLUMN "eventId" TEXT;

ALTER TABLE "Note" ADD CONSTRAINT "Note_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Note_eventId_idx" ON "Note"("eventId");
