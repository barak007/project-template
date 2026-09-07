import { Hono } from "hono";
import { z } from "zod";

import { userMessageResponseSchema } from "../entities/user-message.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";
import { listUserMessages } from "../services/user-messages.js";

export function createUserMessageRoutes(dependencies: RuntimeDependencies) {
  // The invited person's side: what is waiting for them. Keyed by their
  // identity and address, so no invitation token travels anywhere.
  return new Hono<AppBindings>().get("/me/messages", async (context) => {
    const user = context.get("user");
    const result = await listUserMessages(dependencies.db, {
      id: user.id,
      email: user.email,
    });
    return context.json(z.array(userMessageResponseSchema).parse(result), 200);
  });
}
