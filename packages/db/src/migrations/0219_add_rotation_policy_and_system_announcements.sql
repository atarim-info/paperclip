ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "rotation_policy" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'info',
  "target" jsonb,
  "expires_at" timestamp with time zone,
  "created_by_agent_id" uuid,
  "created_by_user_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_announcements_company_idx" ON "system_announcements" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_announcements_expires_idx" ON "system_announcements" ("expires_at");