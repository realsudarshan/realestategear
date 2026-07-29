-- Optional PostgreSQL search acceleration.
-- Run as a database owner or another role allowed to install pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Property_address_trgm_idx" ON "Property" USING GIN ("address" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Property_city_trgm_idx" ON "Property" USING GIN ("city" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Property_state_trgm_idx" ON "Property" USING GIN ("state" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Property_zipcode_trgm_idx" ON "Property" USING GIN ("zipCode" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Property_subdivision_trgm_idx" ON "Property" USING GIN ("subdivision" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_firstName_trgm_idx" ON "Contact" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_lastName_trgm_idx" ON "Contact" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_email_trgm_idx" ON "Contact" USING GIN ("email" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_phone_trgm_idx" ON "Contact" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_company_trgm_idx" ON "Contact" USING GIN ("company" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_title_trgm_idx" ON "Task" USING GIN ("title" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_description_trgm_idx" ON "Task" USING GIN ("description" gin_trgm_ops);
