import { z } from "zod";

import { invitationStatusSchema } from "./invitation.js";
import { memberRoleSchema } from "./organization.js";

/**
 * One inbox row. The message itself holds no words — it carries the invitation
 * it is about, named well enough for a UI to write the sentence, so the wording
 * lives in one place instead of in every row ever written.
 */
export const userMessageResponseSchema = z.object({
  id: z.uuid(),
  kind: z.literal("organization-invitation"),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  invitation: z.object({
    id: z.uuid(),
    organizationId: z.uuid(),
    organizationName: z.string(),
    role: memberRoleSchema,
    status: invitationStatusSchema,
    invitedByName: z.string(),
  }),
});
