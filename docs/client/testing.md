---
type: Guide
title: Testing Client Stories
description: Full user stories run in Node against the real server via the world test-kit.
resource: ../../domain-client/tests/kit/world.ts
tags: [client, testing, kit]
timestamp: 2026-08-06T00:00:00Z
---

# Testing Client Stories

Client logic is tested as **user stories in Node against the real server** —
real routes, real Better Auth (actual password hashing and session cookies),
real committed migrations on PGlite. The API is never mocked.

```ts
import { it } from "./kit/fixtures.js";

it.concurrent("a founder manages sources", async ({ world, expect }) => {
  const { core, organization } = await world.founder("ada");
  await core.sources.create(organization.id, {
    name: "repo",
    kind: "git",
    config: {},
  });
  expect(core.getState().sources).toHaveLength(1);
});
```

## The kit

- `it` — vitest test extended with a per-test `world` fixture, torn down automatically.
- `world.newClient()` — one simulated device: its own core and cookie jar.
- `world.signedUpUser(name?)` — persona: signed up and signed in.
- `world.founder(name?)` — persona: signed in and owning a fresh organization.
- `world.uniqueEmail(name)` — salted address; **never hard-code identifiers**.

## Modes

| Mode             | How                                                              | When                                           |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `http` (default) | One real HTTP server for the whole suite, booted in global-setup | Always — isolation comes from fresh identities |
| `in-process`     | `CLIENT_WORLD=in-process` — a private world per test, no network | When a story needs an untouched database       |

## Rules

- Always `it.concurrent`, always take `expect` from the test context.
- Assert only on state the test's own users can see.
- Grow the kit with domain vocabulary (personas, scenarios), not abstraction.
