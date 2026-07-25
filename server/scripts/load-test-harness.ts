import express from "express";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.LOAD_TEST_PORT || 3199);

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function main() {
  const { prepareEmbeddedPostgresNativeRuntime } = await import(
    "@paperclipai/db/src/embedded-postgres-native.js"
  );
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  await prepareEmbeddedPostgresNativeRuntime();

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-load-test-"));
  const port = await getAvailablePort();

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    createPostgresUser: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: () => {},
    onError: () => {},
  });

  await instance.initialise();
  await instance.start();

  const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  const { ensurePostgresDatabase, applyPendingMigrations } = await import("@paperclipai/db");
  await ensurePostgresDatabase(adminConnectionString, "paperclip");
  const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  await applyPendingMigrations(connectionString);

  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const { instanceSettingsRoutes } = await import("../src/routes/instance-settings.js");
  const { errorHandler } = await import("../src/middleware/index.js");

  const app = express();
  app.use(express.json());

  // Set local_implicit actor (bypasses auth for load testing)
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

  app.use("/api", instanceSettingsRoutes(db));
  app.use(errorHandler);

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Load test server listening on http://127.0.0.1:${PORT}`);
    console.log(`Load test DB: ${connectionString}`);
  });

  const shutdown = async () => {
    console.log("Shutting down load test server...");
    server.close();
    await instance.stop().catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  setTimeout(() => {
    console.log("Load test server auto-shutdown after 10 minutes");
    shutdown();
  }, 10 * 60 * 1000);
}

main().catch((err) => {
  console.error("Failed to start load test server:", err);
  process.exit(1);
});
