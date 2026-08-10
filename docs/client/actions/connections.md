---
type: Action Namespace
title: connections
description: Where an organization's repositories come from — one connection per provider, connected and disconnected explicitly.
resource: ../../../domain-client/connection-actions.ts
tags: [client, actions, connections, git]
timestamp: 2026-08-10T00:00:00Z
---

# `app.connections`

A connection is `{ provider: "local" | "github", label, config }`. It belongs
to the **organization**, not to the person who created it, and it is what
[repositories](./repositories.md) are listed from.

Connecting is deliberately separate from signing in: one user works in many
organizations, each needing its own connection, and an organization's
connection outlives whoever set it up.

## `load(organizationId)`

Replaces `state.connections`. Readable by any member (`resource:read`).

## `connect(organizationId, { provider, config })`

Creates **or replaces** the organization's connection to that provider — an
organization has one of each, so reconnecting with a different folder or
installation does not accumulate. Requires `connection:manage`
(owner/admin), so a `member` gets `FORBIDDEN`.

`config` is provider-specific and validated by the provider itself:

| Provider | `config`       | Meaning                                                     |
| -------- | -------------- | ----------------------------------------------------------- |
| `local`  | `{ rootPath }` | a folder on the machine running the server; `~` is expanded |
| `github` | —              | not registered yet; connecting returns `VALIDATION_FAILED`  |

## `disconnect(organizationId, connectionId)`

Removes it, and with it the repositories it exposed — nothing else can list
them. Sources already imported from it are untouched, and so is any work
session that snapshotted them.

## Notes

- A provider missing from the server's registry is a rejected request, not a
  missing route: `github` behaves that way until its credentials exist.
- A connection id from another organization yields `NOT_FOUND`.
