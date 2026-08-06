---
type: Action Namespace
title: organizations
description: List the user's organizations and create new ones (creator becomes owner).
resource: ../../../client/organization-actions.ts
tags: [client, actions, organizations]
timestamp: 2026-08-06T00:00:00Z
---

# `app.organizations`

## `load()`

Loads every organization the signed-in user belongs to into
`state.organizations`.

## `create({ name })`

Creates an organization and appends it to `state.organizations`. The server
atomically makes the creator its **owner** (see [members](./members.md)).

## Notes

- `state.organizations` is user-scoped — it survives switching between
  organizations, unlike the [current-organization slices](../state.md).
- Names are 1–200 characters; an empty name rejects with a validation
  [ApiError](../errors.md).
