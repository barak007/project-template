import { z } from "zod";

import { idSchema } from "../entities/common.js";

export const organizationParams = z.object({ organizationId: idSchema });
export const workspaceParams = organizationParams.extend({
  workspaceId: idSchema,
});
export const workSessionParams = organizationParams.extend({
  workSessionId: idSchema,
});
