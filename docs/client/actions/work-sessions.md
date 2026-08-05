---
type: Action Namespace
title: workSessions
description: Start and observe work sessions — immutable snapshots of a workspace's sources and merged values, materialized asynchronously.
resource: ../../../client/src/work-session-actions.ts
tags: [client, actions, work-sessions]
timestamp: 2026-08-06T00:00:00Z
---

# `app.workSessions`

Starting a session snapshots, at that moment:

- the [workspace](./workspaces.md)'s sources (`sourcesSnapshot`),
- organization and user [data](./data.md) merged into `dataSnapshot` — **user
  values win on duplicate keys**,
- the merged [secret](./secrets.md) key names as `secretKeys` (sorted; values
  stay server-side).

Materialization is asynchronous: the session is accepted as `"pending"` and a
worker advances it to `"materializing"`, `"ready"`, or `"failed"`
(`failureCode` set).

## `load(organizationId)`

Replaces `state.workSessions`, newest first.

## `start(organizationId, workspaceId)`

Creates the session (write permission required) and appends the `"pending"`
snapshot to `state.workSessions`.

## `refresh(organizationId, workSessionId)`

Re-fetches one session and upserts it — poll this to observe status
transitions.
