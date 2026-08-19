import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { companySecrets } from "@paperclipai/db";
import { eq, and, sql } from "drizzle-orm";
import { forbidden, notFound, unprocessable } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function keyPolicyRoutes(db: Db) {
  const router = Router();

  router.patch("/companies/:companyId/secrets/:secretId/rotation-policy", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const { secretId } = req.params;
    const { rotationPolicy } = req.body;
    // Validate rotationPolicy shape
    if (rotationPolicy !== null && typeof rotationPolicy !== "object") {
      throw unprocessable("rotationPolicy must be an object or null");
    }
    if (rotationPolicy) {
      if (rotationPolicy.intervalDays !== undefined && (typeof rotationPolicy.intervalDays !== "number" || rotationPolicy.intervalDays <= 0)) {
        throw unprocessable("intervalDays must be a positive number");
      }
      if (rotationPolicy.maxAgeDays !== undefined && (typeof rotationPolicy.maxAgeDays !== "number" || rotationPolicy.maxAgeDays <= 0)) {
        throw unprocessable("maxAgeDays must be a positive number");
      }
      if (rotationPolicy.warningDaysBefore !== undefined && (typeof rotationPolicy.warningDaysBefore !== "number" || rotationPolicy.warningDaysBefore <= 0)) {
        throw unprocessable("warningDaysBefore must be a positive number");
      }
    }
    const [secret] = await db
      .select({ id: companySecrets.id })
      .from(companySecrets)
      .where(
        and(
          eq(companySecrets.id, secretId),
          eq(companySecrets.companyId, req.params.companyId),
        ),
      );
    if (!secret) throw notFound("Secret not found");
    const [updated] = await db
      .update(companySecrets)
      .set({
        rotationPolicy: rotationPolicy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(companySecrets.id, secretId))
      .returning();
    res.json(updated);
  });

  router.get("/companies/:companyId/secrets/overdue-rotations", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const now = new Date();
    // Find secrets where rotationPolicy.intervalDays is set and lastRotatedAt is older than interval
    const overdue = await db
      .select()
      .from(companySecrets)
      .where(
        and(
          eq(companySecrets.companyId, req.params.companyId),
          sql`${companySecrets.rotationPolicy} ->> 'intervalDays' IS NOT NULL`,
          sql`${companySecrets.lastRotatedAt} IS NOT NULL`,
          sql`${companySecrets.lastRotatedAt} < NOW() - (${companySecrets.rotationPolicy} ->> 'intervalDays')::int * INTERVAL '1 day'`,
        ),
      );
    res.json(overdue);
  });

  return router;
}