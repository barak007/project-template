---
type: Action Namespace
title: members
description: Manage an organization's membership roster and roles.
resource: ../../../domain-client/member-actions.ts
tags: [client, actions, members, permissions]
timestamp: 2026-08-06T00:00:00Z
---

# `app.members`

## `load(organizationId)`

Loads the roster into `state.members`. Readable by **everyone in the
organization**: membership is the only access control there is, so who else can
see this is not an owner's secret. Non-members get `FORBIDDEN`.

## `put(organizationId, { userId, role })`

Changes an existing member's role; replaces their entry in `state.members`.
Owner-only.

It **cannot add anyone**: a user id that is not already a member is a
`NOT_FOUND`. Joining is an [invitation](./invitations.md) the invited person
accepts from their [inbox](./inbox.md), which is the only thing in the system
that creates a membership.

## Roles

| Role     | Can                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | Everything: memberships, resources, secrets                                                                                                           |
| `admin`  | Resources ([sources](./sources.md), [workspaces](./workspaces.md), [work sessions](./work-sessions.md)) and [secrets](./secrets.md)/[data](./data.md) |
| `member` | Read resources only                                                                                                                                   |

Every violation surfaces as an [ApiError](../errors.md) with code
`FORBIDDEN`; non-members cannot even read.
