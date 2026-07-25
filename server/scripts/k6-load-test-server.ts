import express from "express";
import { instanceSettingsRoutes } from "../src/routes/instance-settings.js";
import { errorHandler } from "../src/middleware/index.js";
import { createDb as createPGliteDb } from "@paperclipai/db";

const PORT = Number(process.env.LOAD_TEST_PORT || 3199);

interface MockQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

class MockDb {
  select() {
    return {
      from: () => ({
        where: () => Promise.resolve([]),
        then: (fn: (rows: unknown[]) => unknown) => fn([]),
      }),
    };
  }
  insert(_table: unknown) {
    return {
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve([{
            id: "mock-settings-id",
            singletonKey: "default",
            general: {},
            experimental: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          }]),
        }),
      }),
    };
  }
  update(_table: unknown) {
    return {
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{
            id: "mock-settings-id",
            singletonKey: "default",
            general: {},
            experimental: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          }]),
        }),
      }),
    };
  }
}

async function main() {
  const db = new MockDb();

  const app = express();
  app.use(express.json());

  // Set local_implicit actor
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "load-test-runner",
      userName: "Load Test",
      userEmail: null,
      isInstanceAdmin: true,
      source: "local_implicit",
    };
    next();
  });

  app.use("/api", instanceSettingsRoutes(db as any));
  app.use(errorHandler);

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`k6 load test server listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start k6 load test server:", err);
  process.exit(1);
});