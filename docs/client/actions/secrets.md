---
type: Action Namespace
title: organizationSecrets & userSecrets
description: Write-only secret values under named keys — encrypted at rest, never returned, never in client state.
resource: ../../../domain-client/secret-actions.ts
tags: [client, actions, secrets]
timestamp: 2026-08-06T00:00:00Z
---

# `app.organizationSecrets` / `app.userSecrets`

Secrets are **write-only from the client's perspective**: the API returns only
`{ id, key, createdAt, updatedAt }`, so secret values never enter
[client state](../state.md) — a story test asserts the value string appears
nowhere in the tree. [Work sessions](./work-sessions.md) expose merged key
_names_ as `secretKeys`.

Keys are `[A-Za-z0-9_.-]`, max 128 chars; values up to 64 KiB.

## Organization scope — `app.organizationSecrets`

Managing requires the `secret:manage` permission (owner/admin — see
[members](./members.md)).

- `load(organizationId)` — list key metadata into `state.organizationSecrets`
- `put(organizationId, { key, value })` — create or replace; upserts by key
- `delete(organizationId, key)`

## User scope — `app.userSecrets`

The signed-in user's own secrets; no organization involved.

- `load()` / `put({ key, value })` / `delete(key)` — same semantics into
  `state.userSecrets`
