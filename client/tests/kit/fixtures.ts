import { test } from "vitest";

import { createWorld } from "./world.js";
import type { World } from "./world.js";

/**
 * `it` with a per-test `world` fixture, torn down automatically. Every test
 * gets an isolated universe, which is what makes `it.concurrent` safe —
 * client story tests should always run concurrently.
 */
export const it = test.extend<{ world: World }>({
  world: async ({ task }, use) => {
    void task;
    const world = await createWorld();
    await use(world);
    await world.close();
  },
});
