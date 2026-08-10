---
type: Action Namespace
title: workSessions
description: Start and observe work sessions — immutable snapshots of a workspace's sources and merged values, materialized asynchronously.
resource: ../../../domain-client/work-session-actions.ts
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
(`failureCode` set). What the worker builds is a **git project** — one submodule
per git source in the snapshot, each checked out on a branch. `projectLocation`
(where it was built) and `projectBranch` are null until `"ready"`.

## `load(organizationId)`

Replaces `state.workSessions`, newest first.

## `start(organizationId, workspaceId)`

Creates the session (write permission required) and appends the `"pending"`
snapshot to `state.workSessions`.

## `refresh(organizationId, workSessionId)`

Re-fetches one session and upserts it — poll this to observe status
transitions.

## `branchAll(organizationId, workSessionId, branch)`

Puts every repository in the session's project on `branch`, creating it where it
does not exist, and upserts the updated session. Requires `resource:write`.

The command a user reaches for first: a submodule is checked out detached, so
committing needs a branch. Before the project exists — while the session is still
preparing — this is `VALIDATION_FAILED`, and a project the running builder cannot
reach (a bucket, from a local server) is the same.
