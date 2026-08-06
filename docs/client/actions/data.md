---
type: Action Namespace
title: organizationData & userData
description: Non-secret JSON values under named keys, merged into work-session snapshots (user wins).
resource: ../../../client/data-actions.ts
tags: [client, actions, data]
timestamp: 2026-08-06T00:00:00Z
---

# `app.organizationData` / `app.userData`

Plain (non-secret) JSON values under named keys — the readable sibling of
[secrets](./secrets.md). Keys share the same format (`[A-Za-z0-9_.-]`, max
128); values are arbitrary JSON.

When a [work session](./work-sessions.md) starts, organization and user data
merge into its `dataSnapshot`; **user values win on duplicate keys**.

## Organization scope — `app.organizationData`

Writing requires write permission (owner/admin); members read.

- `load(organizationId)` — into `state.organizationData`
- `put(organizationId, { key, value })` — create or replace; upserts by key

## User scope — `app.userData`

- `load()` / `put({ key, value })` — same semantics into `state.userData`
