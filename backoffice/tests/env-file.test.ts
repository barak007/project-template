import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { upsertEnvFileValues } from "../server/env-file.js";

let directory = "";

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "env-file-"));
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("upsertEnvFileValues", () => {
  it("creates the file when it is missing", async () => {
    const filePath = join(directory, "created.env");
    await upsertEnvFileValues(filePath, { A: "1", B: "2" });
    expect(await readFile(filePath, "utf8")).toBe("A=1\nB=2\n");
  });

  it("replaces existing keys in place and appends new ones", async () => {
    const filePath = join(directory, "updated.env");
    await upsertEnvFileValues(filePath, { A: "1", B: "2" });
    await upsertEnvFileValues(filePath, { B: "changed", C: "3" });
    expect(await readFile(filePath, "utf8")).toBe("A=1\nB=changed\nC=3\n");
  });

  it("preserves comments and unrelated lines", async () => {
    const filePath = join(directory, "commented.env");
    await upsertEnvFileValues(filePath, { KEEP: "yes" });
    await upsertEnvFileValues(filePath, { NEW: "value" });
    const content = await readFile(filePath, "utf8");
    expect(content).toContain("KEEP=yes");
    expect(content).toContain("NEW=value");
  });
});
