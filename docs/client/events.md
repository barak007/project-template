---
type: Concept
title: Events & Projection
description: Actions dispatch event facts; a single pure projection folds them into state.
resource: ../../client/events.ts
tags: [client, events, projection]
timestamp: 2026-08-06T00:00:00Z
---

# Events & Projection

Decoupling in the core is done via events. [Actions](./actions/index.md) never
touch state; they call the API and dispatch a `ClientEvent` — a fact about
what happened:

```
{ type: "signed-in", user }
{ type: "source-created", organizationId, source }
{ type: "user-secret-deleted", key }
```

The **projection** (`client/projection.ts`) is the one place state
changes: a pure `reduce(state, event): ClientState`, exhaustively switching
over every event type. Pure means unit-testable without any API, and means the
whole [state](./state.md) tree is a deterministic fold of the event stream.

## Conventions

- Event names are past-tense facts, kebab-case: `<aggregate>-<happened>`
  (`workspaces-loaded`, `organization-secret-put`).
- Organization-scoped events **carry `organizationId`**; the projection uses
  it to keep state on one organization at a time (see
  [Client State](./state.md)).
- `signed-out` resets everything — the only event that does.

## Adding an event

1. Add the variant to `ClientEvent` (`client/events.ts`).
2. Handle it in `reduce` — the exhaustive switch makes forgetting a compile error.
3. Dispatch it from the owning action module.
