---
type: Action Namespace
title: workspaces
description: CRUD an organization's workspaces — named selections of sources that work sessions run against.
resource: ../../../domain-client/workspace-actions.ts
tags: [client, actions, workspaces]
timestamp: 2026-08-06T00:00:00Z
---

# `app.workspaces`

A workspace is a named selection of [sources](./sources.md):
`{ name, sourceIds }`. Starting a [work session](./work-sessions.md) snapshots
the workspace's sources at that moment.

## `load(organizationId)`

Replaces `state.workspaces` (and makes this the
[current organization](../state.md)). Newest first, so a brand-new
organization's own workspace — created with it and named after it, see
[organizations](./organizations.md) — is the only entry.

## `create(organizationId, { name, sourceIds? })`

Creates and appends to `state.workspaces`. `sourceIds` defaults to `[]`, max
100, must be unique, and must reference this organization's sources.

## `projectLocation`

Read-only on every workspace: where the workspace's **own** git project lives —
the template holding its repositories as submodules, which every session clones.
`null` until the first session builds it. Browse it with
[projectFiles](./project-files.md); the value itself is informational, and may
name a machine the reader has no access to.

## `update(organizationId, workspaceId, { name, sourceIds? })`

Full replacement — the given `sourceIds` become the workspace's exact source
set.

## `delete(organizationId, workspaceId)`

Deletes and removes from `state.workspaces`. Past work sessions keep their
snapshots.
