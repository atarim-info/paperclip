import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { checkPermissions, permissionsRoutes, type GrantRow } from "../routes/permissions.js";
import { errorHandler } from "../middleware/index.js";

describe("checkPermissions (pure function)", () => {
  const appId1 = "123e4567-e89b-12d3-a456-426614174000";
  const appId2 = "223e4567-e89b-12d3-a456-426614174000";

  it("allows action with matching appId scope", () => {
    const grants: GrantRow[] = [
      { permissionKey: "jfp:read", scope: { appId: appId1 } },
    ];
    const result = checkPermissions(grants, appId1, ["jfp:read"]);
    expect(result).toEqual({ "jfp:read": true });
  });

  it("denies action when scope appId does not match", () => {
    const grants: GrantRow[] = [
      { permissionKey: "jfp:read", scope: { appId: appId2 } },
    ];
    const result = checkPermissions(grants, appId1, ["jfp:read"]);
    expect(result).toEqual({ "jfp:read": false });
  });

  it("allows action with null (tenant-wide) scope", () => {
    const grants: GrantRow[] = [
      { permissionKey: "tenant:manage", scope: null },
    ];
    const result = checkPermissions(grants, appId1, ["tenant:manage"]);
    expect(result).toEqual({ "tenant:manage": true });
  });

  it("returns false when no grants exist", () => {
    const result = checkPermissions([], appId1, ["jfp:read"]);
    expect(result).toEqual({ "jfp:read": false });
  });

  it("distinguishes allowed vs denied across multiple actions", () => {
    const grants: GrantRow[] = [
      { permissionKey: "jfp:read", scope: { appId: appId1 } },
      { permissionKey: "tenant:manage", scope: null },
    ];
    const result = checkPermissions(grants, appId1, [
      "jfp:read",
      "jfp:write",
      "tenant:manage",
    ]);
    expect(result).toEqual({
      "jfp:read": true,
      "jfp:write": false,
      "tenant:manage": true,
    });
  });

  it("is not confused by different appId scope", () => {
    const grants: GrantRow[] = [
      { permissionKey: "jfp:read", scope: { appId: appId2 } },
    ];
    const result = checkPermissions(grants, appId1, ["jfp:read"]);
    expect(result).toEqual({ "jfp:read": false });
  });
});

describe("/permissions/check route", () => {
  function createMockDb(grants: GrantRow[]) {
    return {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(grants),
        }),
      }),
    } as never;
  }

  function createApp(actor: Record<string, unknown>, grants: GrantRow[]) {
    const a = express();
    a.use(express.json());
    a.use((req, _res, next) => {
      req.actor = actor as never;
      next();
    });
    a.use("/permissions", permissionsRoutes(createMockDb(grants)));
    a.use(errorHandler);
    return a;
  }

  const companyId = "11111111-1111-4111-8111-111111111111";
  const userId = "test-user-1";
  const appId = "123e4567-e89b-12d3-a456-426614174000";

  const authorizedActor = {
    type: "board",
    userId,
    companyIds: [companyId],
    memberships: [{ companyId, membershipRole: "admin", status: "active" }],
    source: "local_implicit",
  };

  it("returns 200 with allowed results for matching permissions", async () => {
    const grants: GrantRow[] = [
      { permissionKey: "jfp:read", scope: { appId } },
    ];
    const app = createApp(authorizedActor, grants);

    const res = await request(app)
      .post("/permissions/check")
      .send({ appId, actions: ["jfp:read", "jfp:write"] });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toEqual({ "jfp:read": true, "jfp:write": false });
  });

  it("returns 401 for unauthenticated requests", async () => {
    const app = createApp({ type: "none" }, []);

    const res = await request(app)
      .post("/permissions/check")
      .send({ appId, actions: ["jfp:read"] });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid appId", async () => {
    const app = createApp(authorizedActor, []);

    const res = await request(app)
      .post("/permissions/check")
      .send({ appId: "not-a-uuid", actions: ["jfp:read"] });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty actions", async () => {
    const app = createApp(authorizedActor, []);

    const res = await request(app)
      .post("/permissions/check")
      .send({ appId, actions: [] });

    expect(res.status).toBe(400);
  });
});