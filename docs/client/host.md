---
type: Concept
title: Host
description: The injected boundary through which every environmental capability reaches the client core.
resource: ../../domain-client/host.ts
tags: [client, boundary, dependency-injection]
timestamp: 2026-08-06T00:00:00Z
---

# Host

The core never touches its environment directly. Everything environmental
enters through the `Host`, passed to `createClientCore`:

```ts
type Host = {
  fetch: ClientFetch; // (input, init) => Promise<Response>
};
```

The same core therefore runs anywhere a host can be written for:

| Environment | Host                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Browser     | `{ fetch: (input, init) => fetch(input, init) }`                                                          |
| Node tests  | `{ fetch: browserFetch(...) }` — a cookie-jar fetch bound to the test server; see [Testing](./testing.md) |

## Enforcement

Headlessness is enforced, not hoped for:

- **No `"dom"` lib** in any tsconfig — DOM globals are type errors.
- **ESLint bans Node builtins** (`import-x/no-nodejs-modules`) and **platform
  globals** in `client`: `process`, `Buffer`, `window`, `document`,
  `localStorage`, `setTimeout`, and even global `fetch` — the host is the only
  door.
- **Server imports are type-only**: the single allowed crossing is
  `import type { AppType } from "domain-server/app.ts"`; any runtime import of server
  code is an ESLint error.

Grow the host only when the core genuinely needs a new capability (storage,
clock, ...) — never speculatively.
