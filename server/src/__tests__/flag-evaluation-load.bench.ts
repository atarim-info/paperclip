import express from "express";
import { bench, describe } from "vitest";

// Pre-build a light Express app that uses mocked service responses so we
// isolate the HTTP-to-JSON pipeline overhead (middleware stack + JSON parsing
// + route dispatch + JSON serialization) from DB latency.
//
// The mocks return the same payload the real DB-backed service would produce.

const MOCK_EXPERIMENTAL = {
  enableEnvironments: false,
  enableIsolatedWorkspaces: true,
  enableStreamlinedLeftNavigation: false,
  enableConferenceRoomChat: false,
  enableIssuePlanDecompositions: false,
  enableExperimentalFileViewer: false,
  enableCloudSync: false,
  autoRestartDevServerWhenIdle: false,
  enableIssueGraphLivenessAutoRecovery: false,
  issueGraphLivenessAutoRecoveryLookbackHours: 24,
};

const MOCK_GENERAL = {
  censorUsernameInLogs: false,
  keyboardShortcuts: false,
  feedbackDataSharingPreference: "prompt" as const,
  backupRetention: 7,
};

async function buildApp() {
  const request = (await import("supertest")).default;
  const { errorHandler } = await import("../middleware/index.js");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "bench-runner",
      userName: "Benchmark",
      userEmail: null,
      isInstanceAdmin: true,
      source: "local_implicit",
    };
    next();
  });

  app.get("/api/instance/settings/experimental", (_req, res) => {
    res.json(MOCK_EXPERIMENTAL);
  });

  app.get("/api/instance/settings/general", (_req, res) => {
    res.json(MOCK_GENERAL);
  });

  app.use(errorHandler);

  return { app, request };
}

const { app, request } = await buildApp();

describe("flag evaluation engine — HTTP route (mock DB)", () => {
  bench("GET /api/instance/settings/experimental", async () => {
    await request(app).get("/api/instance/settings/experimental").expect(200);
  });

  bench("GET /api/instance/settings/general", async () => {
    await request(app).get("/api/instance/settings/general").expect(200);
  });

  bench("both endpoints sequentially", async () => {
    await request(app).get("/api/instance/settings/experimental").expect(200);
    await request(app).get("/api/instance/settings/general").expect(200);
  });
});