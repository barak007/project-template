import { Hono } from "hono";
import { z } from "zod";

import { idSchema } from "../entities/common.js";
import {
  invitationCreateSchema,
  invitationDecisionSchema,
  invitationResponseSchema,
} from "../entities/invitation.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { validate } from "../http/validation.js";
import {
  inviteMember,
  listInvitations,
  respondToInvitation,
  revokeInvitation,
} from "../services/invitations.js";

import { organizationParams } from "./params.js";

const invitationParams = organizationParams.extend({ invitationId: idSchema });
const userInvitationParams = z.object({ invitationId: idSchema });

export function createInvitationRoutes(dependencies: RuntimeDependencies) {
  return (
    new Hono<AppBindings>()
      // Joining is an invitation to an address, answered by whoever owns it —
      // see /me/invitations below for the other half of the exchange.
      .get(
        "/organizations/:organizationId/invitations",
        validate("param", organizationParams),
        async (context) => {
          const result = await listInvitations(
            dependencies.db,
            context.get("user").id,
            context.req.valid("param").organizationId,
          );
          return context.json(
            z.array(invitationResponseSchema).parse(result),
            200,
          );
        },
      )
      .post(
        "/organizations/:organizationId/invitations",
        validate("param", organizationParams),
        validate("json", invitationCreateSchema),
        async (context) => {
          const result = await inviteMember(
            dependencies.db,
            dependencies.mailer,
            context.get("user").id,
            context.req.valid("param").organizationId,
            context.req.valid("json"),
          );
          return context.json(invitationResponseSchema.parse(result), 201);
        },
      )
      .delete(
        "/organizations/:organizationId/invitations/:invitationId",
        validate("param", invitationParams),
        async (context) => {
          const params = context.req.valid("param");
          const result = await revokeInvitation(
            dependencies.db,
            context.get("user").id,
            params.organizationId,
            params.invitationId,
          );
          return context.json(invitationResponseSchema.parse(result), 200);
        },
      )
      // The invited person's side: their answer to what is waiting for them.
      // Keyed by their identity and address, so no invitation token travels
      // anywhere and a forwarded invitation is unusable by anyone else.
      .post(
        "/me/invitations/:invitationId/response",
        validate("param", userInvitationParams),
        validate("json", invitationDecisionSchema),
        async (context) => {
          const user = context.get("user");
          const result = await respondToInvitation(
            dependencies.db,
            { id: user.id, email: user.email },
            context.req.valid("param").invitationId,
            context.req.valid("json").decision,
          );
          return context.json(invitationResponseSchema.parse(result), 200);
        },
      )
  );
}
