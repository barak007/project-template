import { describe, expect, it } from "vitest";

import { organizationCreateSchema } from "../entities/organization.js";
import { sourceInputSchema } from "../entities/source.js";
import { workspaceInputSchema } from "../entities/workspace.js";

describe("entity schemas", () => {
  it("trims and validates organizations", () => {
    expect(organizationCreateSchema.parse({ name: "  Acme  " })).toEqual({
      name: "Acme",
    });
    expect(() => organizationCreateSchema.parse({ name: "" })).toThrow();
  });

  it("requires explicit, JSON-safe source configuration", () => {
    expect(
      sourceInputSchema.parse({
        name: "repo",
        kind: "git",
        config: { remote: "https://example.test/repo.git" },
      }),
    ).toMatchObject({ kind: "git" });
    expect(() =>
      sourceInputSchema.parse({
        name: "repo",
        kind: "git",
        config: new Date(),
      }),
    ).toThrow();
    // A git source is cloned, so its config is checked here rather than at
    // materialization time — but only a git source's is.
    expect(() =>
      sourceInputSchema.parse({ name: "repo", kind: "git", config: {} }),
    ).toThrow();
    expect(() =>
      sourceInputSchema.parse({
        name: "repo",
        kind: "git",
        config: { remote: "/Users/ada/projects/engine" },
      }),
    ).toThrow();
    expect(
      sourceInputSchema.parse({ name: "db", kind: "database", config: {} }),
    ).toMatchObject({ kind: "database" });
  });

  it("rejects invalid workspace source IDs", () => {
    expect(() =>
      workspaceInputSchema.parse({ name: "main", sourceIds: ["not-a-uuid"] }),
    ).toThrow();
  });
});
