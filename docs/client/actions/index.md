---
type: API
title: Action Namespaces
description: One action namespace per aggregate, mirroring the server's service-per-aggregate layout.
tags: [client, actions]
timestamp: 2026-08-06T00:00:00Z
---

# Action Namespaces

Actions are how anything happens. Each namespace owns one aggregate; every
action calls the API and dispatches an [event](../events.md) — actions never
touch [state](../state.md) directly.

| Namespace                           | Scope        | Actions                              |
| ----------------------------------- | ------------ | ------------------------------------ |
| [auth](./auth.md)                   | —            | `signUp`, `signIn`, `signOut`        |
| [organizations](./organizations.md) | user         | `load`, `create`                     |
| [members](./members.md)             | organization | `load`, `put`                        |
| [sources](./sources.md)             | organization | `load`, `create`, `update`, `delete` |
| [workspaces](./workspaces.md)       | organization | `load`, `create`, `update`, `delete` |
| [workSessions](./work-sessions.md)  | organization | `load`, `start`, `refresh`           |
| [organizationSecrets](./secrets.md) | organization | `load`, `put`, `delete`              |
| [userSecrets](./secrets.md)         | user         | `load`, `put`, `delete`              |
| [organizationData](./data.md)       | organization | `load`, `put`                        |
| [userData](./data.md)               | user         | `load`, `put`                        |

## Conventions

- Organization-scoped actions take `organizationId` as their **first
  argument** — scope is always explicit, never ambient.
- `load` replaces the slice; `create`/`put` insert or upsert; `delete`
  removes. All effects land via events in the projection.
- Failures follow the [error contract](../errors.md).
- Authorization is the server's: owners manage everything, admins manage
  resources and secrets, members read (see [members](./members.md)).
