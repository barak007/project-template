import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../src/db/client.js";
import {
  MATERIALIZE_WORK_SESSION_DEAD_LETTER,
  MATERIALIZE_WORK_SESSION_QUEUE,
} from "../src/jobs/materialize.js";
import { QueueRuntime } from "../src/jobs/queue.js";

const boss = vi.hoisted(() => ({
  start: vi.fn(),
  createQueue: vi.fn(),
  send: vi.fn(),
  work: vi.fn(),
  stop: vi.fn(),
  on: vi.fn(),
}));

vi.mock("pg-boss", () => ({
  PgBoss: class {
    constructor() {
      return boss;
    }
  },
}));

vi.mock("../src/jobs/materialize.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/jobs/materialize.js")>()),
  materializeWorkSession: vi.fn(),
}));

const { materializeWorkSession } = await import("../src/jobs/materialize.js");

describe("QueueRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the work queue with retries and a dead-letter queue", async () => {
    const runtime = new QueueRuntime("postgres://localhost/test");
    await runtime.start();
    expect(boss.start).toHaveBeenCalled();
    expect(boss.createQueue).toHaveBeenCalledWith(
      MATERIALIZE_WORK_SESSION_DEAD_LETTER,
      expect.objectContaining({ policy: "standard" }),
    );
    expect(boss.createQueue).toHaveBeenCalledWith(
      MATERIALIZE_WORK_SESSION_QUEUE,
      expect.objectContaining({
        retryLimit: 5,
        deadLetter: MATERIALIZE_WORK_SESSION_DEAD_LETTER,
      }),
    );
  });

  it("enqueues jobs keyed by work session id", async () => {
    const workSessionId = randomUUID();
    boss.send.mockResolvedValueOnce(workSessionId);
    const runtime = new QueueRuntime("postgres://localhost/test");
    await expect(runtime.enqueueMaterialize({ workSessionId })).resolves.toBe(
      workSessionId,
    );
    expect(boss.send).toHaveBeenCalledWith(
      MATERIALIZE_WORK_SESSION_QUEUE,
      { workSessionId },
      expect.objectContaining({ id: workSessionId }),
    );
  });

  it("rejects invalid job payloads before touching the queue", async () => {
    const runtime = new QueueRuntime("postgres://localhost/test");
    await expect(
      runtime.enqueueMaterialize({ workSessionId: "not-a-uuid" }),
    ).rejects.toThrow();
    expect(boss.send).not.toHaveBeenCalled();
  });

  it("throws when the queue rejects a job", async () => {
    boss.send.mockResolvedValueOnce(null);
    const runtime = new QueueRuntime("postgres://localhost/test");
    await expect(
      runtime.enqueueMaterialize({ workSessionId: randomUUID() }),
    ).rejects.toThrow(/rejected/);
  });

  it("routes worked jobs into the materializer", async () => {
    const runtime = new QueueRuntime("postgres://localhost/test");
    const db = {} as Database;
    await runtime.registerWorkers(db);
    expect(boss.work).toHaveBeenCalledWith(
      MATERIALIZE_WORK_SESSION_QUEUE,
      { batchSize: 1 },
      expect.any(Function),
    );
    const handler = boss.work.mock.calls[0]?.[2] as (
      jobs: { data: unknown }[],
    ) => Promise<void>;
    const workSessionId = randomUUID();
    await handler([{ data: { workSessionId } }]);
    expect(materializeWorkSession).toHaveBeenCalledWith(db, { workSessionId });
    await expect(handler([{ data: {} }])).rejects.toThrow();
  });

  it("stops gracefully", async () => {
    const runtime = new QueueRuntime("postgres://localhost/test");
    await runtime.stop();
    expect(boss.stop).toHaveBeenCalledWith(
      expect.objectContaining({ graceful: true }),
    );
  });
});
