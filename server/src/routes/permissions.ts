import { Router } from "express";
import type { Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import { and, eq } from "drizzle-orm";
import { principalPermissionGrants } from "@paperclipai/db";
import { z } from "zod";
import { badRequest, forbidden } from "../errors.js";
import { assertAuthenticated, assertCompanyAccess } from "./authz.js";

const checkPermissionSchema = z.object({
  appId: z.string().uuid(),
  actions: z.array(z.string()).min(1),
});

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type GrantRow = {
  permissionKey: string;
  scope: Record<string, unknown> | null;
};

export function checkPermissions(
  grants: GrantRow[],
  appId: string,
  actions: string[],
): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const action of actions) {
    results[action] = grants.some(
      (g) =>
        g.permissionKey === action &&
        (g.scope === null ||
          (isPlainRecord(g.scope) && g.scope.appId === appId)),
    );
  }
  return results;
}

export function permissionsRoutes(db: Db) {
  const router = Router({ mergeParams: true });

  router.post("/check", async (req: Request, res: Response) => {
    assertAuthenticated(req);

    const parsed = checkPermissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.message);
    }

    let companyId: string | null = null;
    if (req.actor.type === "board") {
      const ids = req.actor.companyIds ?? [];
      companyId = ids.length > 0 ? ids[0] : null;
    } else if (req.actor.type === "agent") {
      companyId = req.actor.companyId ?? null;
    }
    if (!companyId) throw forbidden("Company access required");
    assertCompanyAccess(req, companyId);

    const userId =
      req.actor.type === "board"
        ? req.actor.userId
        : req.actor.agentId ?? null;
    if (!userId) throw forbidden("Authenticated principal required");

    const { appId, actions } = parsed.data;

    const grants = await db
      .select()
      .from(principalPermissionGrants)
      .where(
        and(
          eq(principalPermissionGrants.companyId, companyId),
          eq(principalPermissionGrants.principalType, "user"),
          eq(principalPermissionGrants.principalId, userId),
        ),
      );

    const allowed = checkPermissions(grants, appId, actions);
    res.json({ allowed });
  });

  return router;
}