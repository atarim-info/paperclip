import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const systemAnnouncements = pgTable(
  "system_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: text("severity").notNull().default("info"),
    target: jsonb("target").$type<{
      userIds?: string[];
      roles?: string[];
      all?: boolean;
    }>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("system_announcements_company_idx").on(table.companyId),
    expiresIdx: index("system_announcements_expires_idx").on(table.expiresAt),
  }),
);