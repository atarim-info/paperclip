-- Step 1: Add company_id column (nullable for safe backfill)
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "company_id" uuid;--> statement-breakpoint

-- Step 2: Backfill company_id from environment_leases, falling back to first company
UPDATE "environments" e
SET "company_id" = COALESCE(
  (SELECT el.company_id FROM "environment_leases" el WHERE el.environment_id = e.id LIMIT 1),
  (SELECT id FROM "companies" ORDER BY created_at ASC LIMIT 1)
)
WHERE e."company_id" IS NULL;--> statement-breakpoint

-- Step 3: Make company_id NOT NULL now that it's backfilled
ALTER TABLE "environments" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint

-- Step 4: Add FK constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'environments_company_id_companies_id_fk'
    AND table_name = 'environments'
  ) THEN
    ALTER TABLE "environments"
      ADD CONSTRAINT "environments_company_id_companies_id_fk"
      FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- Step 5: Drop old single-tenant indexes
DROP INDEX IF EXISTS "environments_local_driver_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "environments_managed_sandbox_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "environments_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "environments_status_idx";--> statement-breakpoint

-- Step 6: Create new per-company indexes matching the current Drizzle schema
CREATE INDEX IF NOT EXISTS "environments_company_status_idx" ON "environments" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environments_company_driver_idx" ON "environments" USING btree ("company_id","driver") WHERE "driver" = 'local';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environments_company_name_idx" ON "environments" USING btree ("company_id","name");
