---
type: API
title: Headless Client Core
description: The rendering-free application client — actions and state, runnable anywhere a Host can be written for.
tags: [client, headless, api]
timestamp: 2026-08-06T00:00:00Z
---

# Headless Client Core

The application client is **headless by principle: all client logic is actions
and state — rendering is never required to run it.** Any UI (React, CLI, TUI)
is a thin adapter that subscribes to [state](./state.md) and calls
[actions](./actions/index.md); it owns no logic.

## Creating a core

```ts
import { createClientCore } from "../../client/index.js";

const app = createClientCore({
  baseUrl: "https://api.example.com",
  host: { fetch: (input, init) => fetch(input, init) }, // browser host
});

await app.auth.signIn({ email, password });
await app.organizations.load();
app.getState().organizations;
```

## Architecture

Decoupling is event-driven:

```
action → API call → dispatch(ClientEvent)
                          ↓
              reduce(state, event)   ← the ONE place state changes
                          ↓
                subscribers notified
```

- [Host](./host.md) — the injected environment boundary; the core touches no platform globals
- [State](./state.md) — one immutable tree; organization slices follow the organization being worked on
- [Events](./events.md) — the facts actions dispatch, folded by a pure projection
- [Actions](./actions/index.md) — one namespace per aggregate, mirroring the server's services
- [Errors](./errors.md) — the failure contract (`ApiError` vs. auth-as-state)
- [Testing](./testing.md) — full user stories in Node against the real server

## Guarantees

- **No DOM, no Node builtins, no platform globals** — ESLint- and tsconfig-enforced; see [Host](./host.md)
- **End-to-end types** from the server's `AppType` (Hono RPC); no codegen
- **Secret values never enter client state** — the server never returns them; see [secrets](./actions/secrets.md)
