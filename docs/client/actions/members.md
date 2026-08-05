---
type: Action Namespace
title: members
description: Manage an organization's membership roster and roles.
resource: ../../../client/src/member-actions.ts
tags: [client, actions, members, permissions]
timestamp: 2026-08-06T00:00:00Z
---

# `app.members`

## `load(organizationId)`

Loads the roster into `state.members`. **Management-only**: plain members get
`FORBIDDEN` — the roster is visible to owners, not to each other.

## `put(organizationId, { userId, role })`

Adds a user to the organization or changes their role; upserts into
`state.members`. Owner-only.

## Roles

| Role     | Can                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | Everything: memberships, resources, secrets                                                                                                           |
| `admin`  | Resources ([sources](./sources.md), [workspaces](./workspaces.md), [work sessions](./work-sessions.md)) and [secrets](./secrets.md)/[data](./data.md) |
| `member` | Read resources only                                                                                                                                   |

Every violation surfaces as an [ApiError](../errors.md) with code
`FORBIDDEN`; non-members cannot even read.
