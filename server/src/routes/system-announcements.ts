import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { forbidden, notFound } from "../errors.js";
import { systemAnnouncementService } from "../services/system-announcements.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function systemAnnouncementRoutes(db: Db) {
  const router = Router();
  const svc = systemAnnouncementService(db);

  router.get("/companies/:companyId/system-announcements", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const list = await svc.list(req.params.companyId);
    res.json(list);
  });

  router.get("/companies/:companyId/system-announcements/:id", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const item = await svc.getById(req.params.id, req.params.companyId);
    res.json(item);
  });

  router.post("/companies/:companyId/system-announcements", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const { title, body, severity, target, expiresAt } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }
    const actor = req.actor;
    const createdByAgentId = actor.type === "agent" ? actor.agentId : null;
    const createdByUserId = actor.userId ?? null;
    const created = await svc.create(req.params.companyId, {
      title,
      body,
      severity,
      target,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdByAgentId,
      createdByUserId,
    });
    res.status(201).json(created);
  });

  router.patch("/companies/:companyId/system-announcements/:id", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const { title, body, severity, target, expiresAt } = req.body;
    const updated = await svc.update(req.params.id, req.params.companyId, {
      title,
      body,
      severity,
      target,
      expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
    });
    res.json(updated);
  });

  router.delete("/companies/:companyId/system-announcements/:id", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    await svc.delete(req.params.id, req.params.companyId);
    res.status(204).end();
  });

  router.get("/companies/:companyId/system-announcements/active", async (req, res) => {
    assertBoard(req);
    assertCompanyAccess(req, req.params.companyId);
    const list = await svc.getActive(req.params.companyId);
    res.json(list);
  });

  return router;
}