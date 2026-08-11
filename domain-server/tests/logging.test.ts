import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, silentLogger } from "../logging.js";

function captured() {
  const out = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return {
    info: () => out.mock.calls.map(([line]) => String(line)),
    error: () => err.mock.calls.map(([line]) => String(line)),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("writes the level, message and fields as one greppable line", () => {
    const lines = captured();

    createLogger({ LOG_LEVEL: "info" }).info("session ready", {
      workSessionId: "abc",
      ms: 12,
    });

    expect(lines.info()).toEqual([
      "INFO  session ready workSessionId=abc ms=12",
    ]);
  });

  it("drops anything below the configured level", () => {
    const lines = captured();
    const log = createLogger({ LOG_LEVEL: "warn" });

    log.debug("git");
    log.info("preparing");
    log.warn("slow");

    // `LOG_LEVEL` is what makes debug-level git tracing safe to ship.
    expect(lines.info()).toEqual([]);
    expect(lines.error()).toEqual(["WARN  slow"]);
  });

  it("sends warnings and errors to stderr so a terminal separates them", () => {
    const lines = captured();
    const log = createLogger({ LOG_LEVEL: "debug" });

    log.debug("git");
    log.error("git failed", { reason: "no such repository" });

    expect(lines.info()).toEqual(["DEBUG git"]);
    // A value with spaces stays one field.
    expect(lines.error()).toEqual([
      'ERROR git failed reason="no such repository"',
    ]);
  });

  it("stamps a child's fields onto every line it writes", () => {
    const lines = captured();

    const log = createLogger({ LOG_LEVEL: "info" }).child({
      workSessionId: "s1",
    });
    log.info("preparing", { repositories: 2 });
    log.child({ step: "clone" }).info("cloning");

    expect(lines.info()).toEqual([
      "INFO  preparing workSessionId=s1 repositories=2",
      "INFO  cloning workSessionId=s1 step=clone",
    ]);
  });

  it("discards everything when silent", () => {
    const lines = captured();

    silentLogger.error("boom");
    silentLogger.child({ a: "b" }).info("hello");

    expect([...lines.info(), ...lines.error()]).toEqual([]);
  });
});
