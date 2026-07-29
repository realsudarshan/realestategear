-- One note per event. Enforce at the DB level so concurrent writers can't create duplicates.
ALTER TABLE "Note" ADD CONSTRAINT "Note_eventId_key" UNIQUE ("eventId");
