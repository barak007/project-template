import { PgBoss } from "pg-boss";

import type { Database } from "../db/client.js";

import {
  MATERIALIZE_WORK_SESSION_DEAD_LETTER,
  MATERIALIZE_WORK_SESSION_QUEUE,
  materializeWorkSession,
  materializeWorkSessionJobSchema,
  type MaterializeWorkSessionJob,
} from "./materialize.js";

export type JobProducer = {
  enqueueMaterialize(input: MaterializeWorkSessionJob): Promise<string>;
};

export class QueueRuntime implements JobProducer {
  private readonly boss: PgBoss;

  constructor(databaseUrl: string) {
    this.boss = new PgBoss({
      connectionString: databaseUrl,
      application_name: "what-we-sure-about-jobs",
    });
    this.boss.on("error", (error) => console.error("Queue error", error));
  }

  async start(): Promise<void> {
    await this.boss.start();
    await this.boss.createQueue(MATERIALIZE_WORK_SESSION_DEAD_LETTER, {
      policy: "standard",
    });
    await this.boss.createQueue(MATERIALIZE_WORK_SESSION_QUEUE, {
      policy: "standard",
      retryLimit: 5,
      retryDelay: 5,
      retryBackoff: true,
      retryDelayMax: 300,
      expireInSeconds: 900,
      retentionSeconds: 86_400,
      deadLetter: MATERIALIZE_WORK_SESSION_DEAD_LETTER,
    });
  }

  async enqueueMaterialize(input: MaterializeWorkSessionJob): Promise<string> {
    const data = materializeWorkSessionJobSchema.parse(input);
    const id = await this.boss.send(MATERIALIZE_WORK_SESSION_QUEUE, data, {
      id: data.workSessionId,
      retryLimit: 5,
      retryDelay: 5,
      retryBackoff: true,
      retryDelayMax: 300,
      expireInSeconds: 900,
      deadLetter: MATERIALIZE_WORK_SESSION_DEAD_LETTER,
    });
    if (!id) throw new Error("Queue rejected materialization job");
    return id;
  }

  async registerWorkers(db: Database): Promise<void> {
    await this.boss.work(
      MATERIALIZE_WORK_SESSION_QUEUE,
      { batchSize: 1 },
      async ([job]) => {
        const input = materializeWorkSessionJobSchema.parse(job?.data);
        await materializeWorkSession(db, input);
      },
    );
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10_000 });
  }
}
