import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../db/client.js";
import { organizationInvitations, organizationMembers } from "../db/schema.js";

import {
  asUser,
  createTestApp,
  createTestDatabase,
  createTestUser,
  joinOrganization,
  jsonBody,
} from "./helpers/harness.js";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createTestApp>["app"];
let sentMail: ReturnType<typeof createTestApp>["sentMail"];

const owner = "invite-owner";
const admin = "invite-admin";
const guest = "invite-guest";
const outsider = "invite-outsider";
/** createTestUser gives every user `${id}@example.test`. */
const guestEmail = `${guest}@example.test`;
let organizationId = "";

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function invite(
  userId: string,
  body: Record<string, unknown>,
  targetOrganizationId = organizationId,
) {
  return app.request(
    `/api/organizations/${targetOrganizationId}/invitations`,
    asUser(userId, jsonBody(body)),
  );
}

function respond(userId: string, invitationId: string, decision: string) {
  return app.request(
    `/api/me/invitations/${invitationId}/response`,
    asUser(userId, jsonBody({ decision })),
  );
}

async function inviteGuest(role = "member") {
  const response = await invite(owner, { email: guestEmail, role });
  expect(response.status).toBe(201);
  return (await json(response)) as { id: string; email: string; role: string };
}

async function members(userId: string) {
  const response = await app.request(
    `/api/organizations/${organizationId}/members`,
    asUser(userId),
  );
  return (await json(response)) as { userId: string; role: string }[];
}

beforeAll(async () => {
  ({ db, close } = await createTestDatabase());
  ({ app, sentMail } = createTestApp(db));
  for (const id of [owner, admin, guest, outsider])
    await createTestUser(db, id);

  const created = await app.request(
    "/api/organizations",
    asUser(owner, jsonBody({ name: "Invitations" })),
  );
  expect(created.status).toBe(201);
  organizationId = ((await json(created)) as { id: string }).id;
  await joinOrganization(db, organizationId, admin, "admin");
});

afterAll(async () => {
  await close();
});

// Every story starts from "nobody has been invited": an assertion that fails
// mid-story would otherwise leave the next one facing a member it did not make.
afterEach(reset);

/**
 * Between stories: the guest is outside the organization again, nothing is
 * offered to them, and the outbox is empty.
 */
async function reset() {
  await db
    .delete(organizationInvitations)
    .where(eq(organizationInvitations.organizationId, organizationId));
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.userId, guest));
  sentMail.length = 0;
}

describe("inviting people to an organization", () => {
  it("invites an address, mails it, and grants nothing yet", async () => {
    const invitation = await inviteGuest("admin");

    expect(invitation).toMatchObject({
      email: guestEmail,
      role: "admin",
      status: "pending",
    });
    expect(sentMail).toEqual([
      {
        to: guestEmail,
        organizationName: "Invitations",
        invitedByName: `User ${owner}`,
        role: "admin",
        hasAccount: true,
      },
    ]);
    // The offer exists; the membership does not.
    expect(await members(owner)).toHaveLength(2);
  });

  it("normalises the address, so case is not a second person", async () => {
    const response = await invite(owner, {
      email: `  ${guestEmail.toUpperCase()} `,
      role: "member",
    });

    expect(response.status).toBe(201);
    expect(await json(response)).toMatchObject({ email: guestEmail });
  });

  it("invites an address with no account at all", async () => {
    const response = await invite(owner, {
      email: "nobody@example.test",
      role: "member",
    });

    expect(response.status).toBe(201);
    expect(sentMail.at(-1)).toMatchObject({
      to: "nobody@example.test",
      hasAccount: false,
    });
  });

  it("re-inviting changes the offer instead of making a second one", async () => {
    const first = await inviteGuest("member");
    const second = await inviteGuest("admin");

    expect(second.id).toBe(first.id);
    expect(second.role).toBe("admin");
    const listed = await app.request(
      `/api/organizations/${organizationId}/invitations`,
      asUser(owner),
    );
    expect(await json(listed)).toHaveLength(1);
  });

  it("rejects an address that is not one", async () => {
    const response = await invite(owner, {
      email: "not-an-email",
      role: "member",
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("restricts inviting, listing and revoking to owners", async () => {
    expect(
      (await invite(admin, { email: guestEmail, role: "member" })).status,
    ).toBe(403);
    const listed = await app.request(
      `/api/organizations/${organizationId}/invitations`,
      asUser(admin),
    );
    expect(listed.status).toBe(403);
  });

  it("hides an organization the caller does not belong to at all", async () => {
    const theirs = await app.request(
      "/api/organizations",
      asUser(outsider, jsonBody({ name: "Elsewhere" })),
    );
    const theirOrganizationId = ((await json(theirs)) as { id: string }).id;

    const response = await invite(
      owner,
      { email: guestEmail, role: "member" },
      theirOrganizationId,
    );

    expect(response.status).toBe(403);
  });

  it("refuses to invite someone who is already a member", async () => {
    const response = await invite(owner, {
      email: `${admin}@example.test`,
      role: "member",
    });

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ error: { code: "CONFLICT" } });
  });

  it("revokes an invitation, and only while it is unanswered", async () => {
    const invitation = await inviteGuest();

    const revoked = await app.request(
      `/api/organizations/${organizationId}/invitations/${invitation.id}`,
      asUser(owner, { method: "DELETE" }),
    );
    expect(revoked.status).toBe(200);
    expect(await json(revoked)).toMatchObject({ status: "revoked" });

    const again = await app.request(
      `/api/organizations/${organizationId}/invitations/${invitation.id}`,
      asUser(owner, { method: "DELETE" }),
    );
    expect(again.status).toBe(404);

    // A revoked offer is not answerable either.
    expect((await respond(guest, invitation.id, "accept")).status).toBe(409);
  });
});

describe("answering an invitation", () => {
  it("puts it in the invited person's inbox, naming who and what", async () => {
    const invitation = await inviteGuest("admin");

    const inbox = await app.request("/api/me/messages", asUser(guest));
    expect(inbox.status).toBe(200);
    expect(await json(inbox)).toMatchObject([
      {
        kind: "organization-invitation",
        readAt: null,
        invitation: {
          id: invitation.id,
          organizationName: "Invitations",
          role: "admin",
          status: "pending",
          invitedByName: `User ${owner}`,
        },
      },
    ]);
  });

  it("delivers to an inbox even when the invitation predates the account", async () => {
    // The address had no account when the invitation was written: nothing was
    // delivered then, and reading the inbox is what finds it.
    await db.insert(organizationInvitations).values({
      organizationId,
      email: guestEmail,
      role: "member",
      invitedByUserId: owner,
    });

    const inbox = await app.request("/api/me/messages", asUser(guest));

    expect(await json(inbox)).toHaveLength(1);
    // Reading twice does not deliver twice.
    const again = await app.request("/api/me/messages", asUser(guest));
    expect(await json(again)).toHaveLength(1);
  });

  it("accepting creates the membership with the role offered", async () => {
    const invitation = await inviteGuest("admin");

    const response = await respond(guest, invitation.id, "accept");

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: "accepted" });
    expect(await members(owner)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: guest, role: "admin" }),
      ]),
    );

    // The inbox row now says so, and is no longer news.
    const inbox = (await json(
      await app.request("/api/me/messages", asUser(guest)),
    )) as { readAt: string | null }[];
    expect(inbox[0]?.readAt).not.toBeNull();
  });

  it("declining answers it and leaves them outside", async () => {
    const invitation = await inviteGuest();

    const response = await respond(guest, invitation.id, "decline");

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: "declined" });
    expect((await respond(guest, invitation.id, "decline")).status).toBe(409);
  });

  it("is not answerable by anyone other than the address it names", async () => {
    const invitation = await inviteGuest();

    // Not a 403: an invitation addressed to someone else is not this user's to
    // know about at all.
    expect((await respond(outsider, invitation.id, "accept")).status).toBe(404);
    expect((await respond(owner, invitation.id, "accept")).status).toBe(404);
  });

  it("rejects a decision that is not one, and an unknown invitation", async () => {
    const invitation = await inviteGuest();

    expect((await respond(guest, invitation.id, "maybe")).status).toBe(400);
    expect(
      (await respond(guest, "00000000-0000-4000-8000-000000000000", "accept"))
        .status,
    ).toBe(404);
  });
});
