---
type: Action Namespace
title: sources
description: CRUD an organization's sources — named, kinded configurations (git, database, other).
resource: ../../../domain-client/source-actions.ts
tags: [client, actions, sources]
timestamp: 2026-08-06T00:00:00Z
---

# `app.sources`

A source is `{ name, kind: "git" | "database" | "other", config }` where
`config` is arbitrary JSON. Sources feed [workspaces](./workspaces.md), and
their state at [work-session](./work-sessions.md) start is snapshotted.

## `load(organizationId)`

Replaces `state.sources` with the organization's sources (and makes this the
[current organization](../state.md)).

## `create(organizationId, { name, kind, config })`

Creates and appends to `state.sources`. Write-permission required
(owner/admin — see [members](./members.md)).

## `update(organizationId, sourceId, { name, kind, config })`

Full replacement of the source's fields; replaces it in `state.sources`.

## `delete(organizationId, sourceId)`

Deletes and removes from `state.sources`.

## Notes

- Deleting a source that a workspace references detaches it from the
  workspace's `sourceIds`.
- A source id from another organization yields `NOT_FOUND`, never cross-tenant
  access.
