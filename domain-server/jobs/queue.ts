import { PgBoss } from "pg-boss";

import type { Database } from "../db/client.js";
import type { WorkspaceProjectBuilder } from "../git/project-builder.js";
import type { Logger } from "../logging.js";

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

/** One retry story, declared on the queue and repeated per send (pg-boss
 * applies send options over queue options, so both must agree). */
const materializeRetryOptions = {
  retryLimit: 5,
  retryDelay: 5,
  retryBackoff: true,
  retryDelayMax: 300,
  expireInSeconds: 900,
  deadLetter: MATERIALIZE_WORK_SESSION_DEAD_LETTER,
} as const;

export class QueueRuntime implements JobProducer {
  private readonly boss: PgBoss;

  constructor(
    databaseUrl: string,
    private readonly log: Logger,
  ) {
    this.boss = new PgBoss({
      connectionString: databaseUrl,
      application_name: "what-we-sure-about-jobs",
    });
    this.boss.on("error", (error) =>
      this.log.error("Queue error", { error: error.message }),
    );
  }

  async start(): Promise<void> {
    await this.boss.start();
    await this.boss.createQueue(MATERIALIZE_WORK_SESSION_DEAD_LETTER, {
      policy: "standard",
    });
    await this.boss.createQueue(MATERIALIZE_WORK_SESSION_QUEUE, {
      policy: "standard",
      retentionSeconds: 86_400,
      ...materializeRetryOptions,
    });
  }

  async enqueueMaterialize(input: MaterializeWorkSessionJob): Promise<string> {
    const data = materializeWorkSessionJobSchema.parse(input);
    const id = await this.boss.send(MATERIALIZE_WORK_SESSION_QUEUE, data, {
      id: data.workSessionId,
      ...materializeRetryOptions,
    });
    if (!id) throw new Error("Queue rejected materialization job");
    return id;
  }

  async registerWorkers(
    db: Database,
    projectBuilder: WorkspaceProjectBuilder,
  ): Promise<void> {
    await this.boss.work(
      MATERIALIZE_WORK_SESSION_QUEUE,
      { batchSize: 1 },
      async ([job]) => {
        const input = materializeWorkSessionJobSchema.parse(job?.data);
        await materializeWorkSession(db, projectBuilder, input, this.log);
      },
    );
  }

  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: 10_000 });
  }
}
