---
type: Action Namespace
title: repositories
description: The repositories a connection exposes, and importing one as the git source a workspace references.
resource: ../../../domain-client/repository-actions.ts
tags: [client, actions, repositories, git]
timestamp: 2026-08-10T00:00:00Z
---

# `app.repositories`

A repository is `{ connectionId, externalId, name, remote }` — what a
[connection](./connections.md) can see right now. Repositories are **not
stored**: they are re-read from the provider on demand, so a folder that
gained a repository this morning lists it this afternoon.

Importing is what makes one durable. It creates a `kind: "git"`
[source](./sources.md) the organization owns, which is what a
[workspace](./workspaces.md) references and a
[work session](./work-sessions.md) snapshots.

## `load(organizationId)`

Replaces `state.repositories` with everything the organization's connections
expose. Requires `resource:read`. With no connections it is simply empty.

## `importRepository(organizationId, { connectionId, externalId })`

Imports one repository and **returns the source**, upserting it into
`state.sources`. Requires `resource:write`.

Importing is **idempotent**: a repository already imported returns the source
that exists rather than creating a second one, so adding the same repository
to a second workspace reuses it. That is why this dispatches
`repository-imported` and not `source-created`.

## Notes

- The product word is **repository**. "Source" is how the server stores one,
  and the app never shows it.
- An `externalId` the connection no longer exposes yields `NOT_FOUND` — a
  repository deleted or renamed since the list was read.
- A connection id from another organization yields `NOT_FOUND`.
