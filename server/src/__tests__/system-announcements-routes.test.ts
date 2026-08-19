import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { systemAnnouncementRoutes } from "../routes/system-announcements.js";
import { errorHandler } from "../middleware/error-handler.js";

const mockService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getActive: vi.fn(),
}));

vi.mock("../services/system-announcements.js", () => ({
  systemAnnouncementService: () => mockService,
}));

vi.mock("../routes/authz.js", () => ({
  assertBoard: vi.fn(),
  assertCompanyAccess: vi.fn(),
}));

describe("systemAnnouncementRoutes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    // mock actor
    app.use((req, res, next) => {
      (req as any).actor = {
        type: "board",
        userId: "user1",
        agentId: null,
      };
      next();
    });
    app.use(systemAnnouncementRoutes({} as any));
    app.use(errorHandler);
  });

  describe("GET /companies/:companyId/system-announcements", () => {
    it("returns list of announcements", async () => {
      const fakeList = [{ id: "1", title: "Test" }];
      mockService.list.mockResolvedValue(fakeList);
      const res = await request(app)
        .get("/companies/c1/system-announcements")
        .expect(200);
      expect(res.body).toEqual(fakeList);
      expect(mockService.list).toHaveBeenCalledWith("c1");
    });
  });

  describe("POST /companies/:companyId/system-announcements", () => {
    it("creates a new announcement", async () => {
      const fakeCreated = { id: "2", title: "New" };
      mockService.create.mockResolvedValue(fakeCreated);
      const res = await request(app)
        .post("/companies/c1/system-announcements")
        .send({ title: "New", body: "Body" })
        .expect(201);
      expect(res.body).toEqual(fakeCreated);
      expect(mockService.create).toHaveBeenCalledWith("c1", {
        title: "New",
        body: "Body",
        severity: undefined,
        target: undefined,
        expiresAt: null,
        createdByAgentId: null,
        createdByUserId: "user1",
      });
    });

    it("returns 400 if title missing", async () => {
      await request(app)
        .post("/companies/c1/system-announcements")
        .send({ body: "Body" })
        .expect(400);
    });
  });
});