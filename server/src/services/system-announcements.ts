import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { systemAnnouncements } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";

type SystemAnnouncement = typeof systemAnnouncements.$inferSelect;

export function systemAnnouncementService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select()
        .from(systemAnnouncements)
        .where(eq(systemAnnouncements.companyId, companyId))
        .orderBy(desc(systemAnnouncements.createdAt));
    },

    async getById(id: string, companyId: string) {
      const [row] = await db
        .select()
        .from(systemAnnouncements)
        .where(
          and(
            eq(systemAnnouncements.id, id),
            eq(systemAnnouncements.companyId, companyId),
          ),
        );
      if (!row) throw notFound("System announcement not found");
      return row;
    },

    async create(
      companyId: string,
      data: {
        title: string;
        body: string;
        severity?: string;
        target?: SystemAnnouncement["target"];
        expiresAt?: Date | null;
        createdByAgentId?: string | null;
        createdByUserId?: string | null;
      },
    ) {
      if (!data.title?.trim()) throw unprocessable("Title is required");
      if (!data.body?.trim()) throw unprocessable("Body is required");
      const [created] = await db
        .insert(systemAnnouncements)
        .values({
          companyId,
          title: data.title.trim(),
          body: data.body.trim(),
          severity: data.severity ?? "info",
          target: data.target ?? null,
          expiresAt: data.expiresAt ?? null,
          createdByAgentId: data.createdByAgentId ?? null,
          createdByUserId: data.createdByUserId ?? null,
        })
        .returning();
      return created;
    },

    async update(
      id: string,
      companyId: string,
      data: Partial<{
        title: string;
        body: string;
        severity: string;
        target: SystemAnnouncement["target"];
        expiresAt: Date | null;
      }>,
    ) {
      const existing = await this.getById(id, companyId);
      const [updated] = await db
        .update(systemAnnouncements)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(systemAnnouncements.id, id))
        .returning();
      return updated;
    },

    async delete(id: string, companyId: string) {
      await this.getById(id, companyId);
      await db.delete(systemAnnouncements).where(eq(systemAnnouncements.id, id));
    },

    async getActive(companyId: string) {
      const now = new Date();
      return db
        .select()
        .from(systemAnnouncements)
        .where(
          and(
            eq(systemAnnouncements.companyId, companyId),
            // not expired
            ...[
              systemAnnouncements.expiresAt.isNull(),
              // @ts-ignore
              systemAnnouncements.expiresAt.gt(now),
            ],
          ),
        )
        .orderBy(desc(systemAnnouncements.createdAt));
    },
  };
}