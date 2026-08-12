import { describe, expect, it } from "vitest";

import type { LogFields } from "../logging.js";
import { silentLogger } from "../logging.js";
import { createLogMailer } from "../mail/mailer.js";

function recordingLogger() {
  const lines: { message: string; fields?: LogFields }[] = [];
  return {
    lines,
    log: {
      ...silentLogger,
      info: (message: string, fields?: LogFields) => {
        lines.push({ message, ...(fields && { fields }) });
      },
    },
  };
}

describe("the default mailer", () => {
  it("logs the invitation, saying where it can be answered", async () => {
    const { lines, log } = recordingLogger();
    const mailer = createLogMailer(log, "https://app.example.test/");

    await mailer.sendInvitation({
      to: "ada@example.test",
      organizationName: "Acme",
      invitedByName: "Grace",
      role: "admin",
      hasAccount: true,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.fields).toMatchObject({
      to: "ada@example.test",
      organization: "Acme",
      role: "admin",
      // One slash, whatever the configured base URL ends with.
      url: "https://app.example.test/app",
      action: "sign-in",
    });
  });

  it("tells an address with no account to sign up", async () => {
    const { lines, log } = recordingLogger();
    const mailer = createLogMailer(log, "https://app.example.test");

    await mailer.sendInvitation({
      to: "nobody@example.test",
      organizationName: "Acme",
      invitedByName: "Grace",
      role: "member",
      hasAccount: false,
    });

    expect(lines[0]?.fields).toMatchObject({
      url: "https://app.example.test/app",
      action: "sign-up",
    });
  });
});
