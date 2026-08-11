import type { Environment } from "./config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured fields, not interpolated strings — a log line stays greppable. */
export type LogFields = Record<string, string | number | boolean | null>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  /** A logger that stamps every line with the same fields — one per job run. */
  child: (fields: LogFields) => Logger;
};

const rank: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * The application log. `LOG_LEVEL` decides what survives, so a developer
 * watching a session materialize can turn on `debug` and see every git command
 * without that noise reaching production.
 */
export function createLogger(
  environment: Pick<Environment, "LOG_LEVEL">,
  base: LogFields = {},
): Logger {
  const threshold = rank[environment.LOG_LEVEL];

  const write = (level: LogLevel, message: string, fields?: LogFields) => {
    if (rank[level] < threshold) return;
    const line = { level, message, ...base, ...fields };
    // Errors and warnings go to stderr so a terminal separates them.
    const sink = rank[level] >= rank.warn ? console.error : console.info;
    sink(format(line));
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (fields) => createLogger(environment, { ...base, ...fields }),
  };
}

/** A logger that discards everything — the default in tests. */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

/**
 * `level message key=value` — readable in a terminal without a log viewer, and
 * still machine-parseable. Values that contain spaces are quoted.
 */
function format(
  line: { level: LogLevel; message: string } & LogFields,
): string {
  const { level, message, ...fields } = line;
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join(" ");
  const label = level.toUpperCase().padEnd(5);
  return pairs ? `${label} ${message} ${pairs}` : `${label} ${message}`;
}

function quote(value: string | number | boolean | null): string {
  const text = String(value);
  return /[\s"]/.test(text) ? JSON.stringify(text) : text;
}
