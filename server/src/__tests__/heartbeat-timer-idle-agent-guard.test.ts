import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  agentWakeupRequests,
  companies,
  createDb,
  heartbeatRunEvents,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { heartbeatService } from "../services/heartbeat.ts";

// ATA-105: timer heartbeats must be suppressed for agents with no active work
// (no assigned issues in a non-terminal status and no active/queued runs).
// Such agents have nothing to act on, so periodic timer wakes create
// process-less runs that go silent and trigger watchdog evaluation issues.

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres idle-agent heartbeat guard tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("heartbeat idle-agent timer guard (ATA-105)", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("heartbeat-idle-agent-guard-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(heartbeatRunEvents);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function insertActiveCompanyAndAgent(opts?: {
    agentStatus?: string;
    lastHeartbeatAt?: Date;
  }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const prefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Active Co",
      status: "active",
      issuePrefix: prefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Test Agent",
      role: "engineer",
      status: (opts?.agentStatus ?? "idle") as "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 60,
          wakeOnDemand: true,
        },
      },
      permissions: {},
      lastHeartbeatAt: opts?.lastHeartbeatAt ?? new Date("2020-01-01T00:00:00Z"),
    });

    return { companyId, agentId, prefix };
  }

  it("does not enqueue a timer heartbeat for an idle agent with no active issues or runs", async () => {
    const { agentId } = await insertActiveCompanyAndAgent();

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(0);
    expect(result.enqueued).toBe(0);

    const runCount = await db
      .select()
      .from(heartbeatRuns)
      .then((rows) => rows.filter((r) => r.agentId === agentId).length);
    expect(runCount).toBe(0);
  });

  it("enqueues a timer heartbeat for an agent with an in_progress issue", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(issues).values({
      id: randomUUID(),
      companyId,
      title: "Active work",
      status: "in_progress",
      assigneeAgentId: agentId,
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(1);
    expect(result.enqueued).toBe(1);
  });

  it("enqueues a timer heartbeat for an agent with a todo issue", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(issues).values({
      id: randomUUID(),
      companyId,
      title: "Pending work",
      status: "todo",
      assigneeAgentId: agentId,
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(1);
    expect(result.enqueued).toBe(1);
  });

  it("enqueues a timer heartbeat for an agent with a blocked issue", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(issues).values({
      id: randomUUID(),
      companyId,
      title: "Blocked work",
      status: "blocked",
      assigneeAgentId: agentId,
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(1);
    expect(result.enqueued).toBe(1);
  });

  it("enqueues a timer heartbeat for an agent with a queued heartbeat run (ATA-105: active run path)", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(heartbeatRuns).values({
      id: randomUUID(),
      companyId,
      agentId,
      invocationSource: "assignment",
      status: "queued",
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(1);
  });

  it("does not enqueue a timer heartbeat for an agent with only done/cancelled issues", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(issues).values([
      {
        id: randomUUID(),
        companyId,
        title: "Finished work",
        status: "done",
        assigneeAgentId: agentId,
      },
      {
        id: randomUUID(),
        companyId,
        title: "Cancelled work",
        status: "cancelled",
        assigneeAgentId: agentId,
      },
    ]);

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(0);
    expect(result.enqueued).toBe(0);

    const runCount = await db
      .select()
      .from(heartbeatRuns)
      .then((rows) => rows.filter((r) => r.agentId === agentId).length);
    expect(runCount).toBe(0);
  });

  it("does not enqueue a timer heartbeat for an agent with only backlog issues (not actionable)", async () => {
    const { companyId, agentId } = await insertActiveCompanyAndAgent();

    await db.insert(issues).values({
      id: randomUUID(),
      companyId,
      title: "Backlog work",
      status: "backlog",
      assigneeAgentId: agentId,
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    expect(result.checked).toBe(0);
    expect(result.enqueued).toBe(0);
  });

  it("does not count interval-elapsed check toward checked when agent is idle", async () => {
    // The agent would pass policy checks but should be filtered before
    // the 'checked' counter increments due to having no active work.
    const { agentId } = await insertActiveCompanyAndAgent({
      lastHeartbeatAt: new Date("2020-01-01T00:00:00Z"),
    });

    const heartbeat = heartbeatService(db);
    const result = await heartbeat.tickTimers(new Date("2026-06-04T00:10:00Z"));

    // Idle agent should not appear in checked at all
    expect(result.checked).toBe(0);
    const runCount = await db
      .select()
      .from(heartbeatRuns)
      .then((rows) => rows.filter((r) => r.agentId === agentId).length);
    expect(runCount).toBe(0);
  });
});
