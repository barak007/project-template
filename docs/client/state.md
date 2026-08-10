---
type: Concept
title: Client State
description: The single immutable state tree — auth, organizations, current-organization slices, and user-scoped values.
resource: ../../domain-client/state.ts
tags: [client, state]
timestamp: 2026-08-06T00:00:00Z
---

# Client State

One immutable tree, read with `getState()`, observed with
`subscribe(listener)`:

```ts
type ClientState = {
  auth: AuthState; // anonymous (± error) | authenticated (user)
  organizations: Organization[]; // every organization the user belongs to

  // Slices scoped to the organization currently being worked on:
  currentOrganizationId: string | null;
  members: Membership[];
  connections: Connection[]; // where repositories come from
  repositories: RemoteRepository[]; // what those connections expose right now
  sources: Source[];
  workspaces: Workspace[];
  workSessions: WorkSession[];
  organizationSecrets: Secret[]; // keys + timestamps only, never values
  organizationData: DataEntry[];

  // Scoped to the signed-in user, independent of any organization:
  userSecrets: Secret[];
  userData: DataEntry[];
};
```

## Current-organization slices

State mirrors a UI that shows **one organization at a time**. Every
organization-scoped [event](./events.md) carries its `organizationId`; when it
differs from `currentOrganizationId`, the projection resets the slices before
applying the event — like navigating to another organization.

## Lifecycle

- `signed-out` resets the **entire** tree to its initial value: identity ends,
  so every identity-scoped slice goes with it.
- All updates are immutable folds in the [projection](./events.md); nothing
  mutates state in place.

## Rendering adapters

A React binding is ~10 lines:

```ts
function useClientState<T>(select: (state: ClientState) => T): T {
  return useSyncExternalStore(app.subscribe, () => select(app.getState()));
}
```
