---
type: Concept
title: Error Contract
description: Authentication failures are state; every other API failure throws a typed ApiError.
resource: ../../client/src/errors.ts
tags: [client, errors]
timestamp: 2026-08-06T00:00:00Z
---

# Error Contract

Two failure channels, chosen by what a UI needs to do with them:

## Authentication failures are state, never thrown

A failed sign-in is a normal outcome a screen must render, so
[auth actions](./actions/auth.md) dispatch `sign-in-failed` and the failure
lands in state:

```ts
app.getState().auth; // { status: "anonymous", error: { code, message } }
```

## Everything else throws `ApiError`

Any non-auth API failure — forbidden, validation, not found — throws an
`ApiError` carrying the server's error envelope:

```ts
class ApiError extends Error {
  code: string; // e.g. "FORBIDDEN", "VALIDATION_ERROR", "AUTHENTICATION_REQUIRED"
}
```

State is left untouched by a failed action. Nothing else ever throws past an
action.

## Common codes

| Code                      | Meaning                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `AUTHENTICATION_REQUIRED` | No session — sign in first                                                              |
| `FORBIDDEN`               | The signed-in user lacks the permission (see [members](./actions/members.md) for roles) |
| `NOT_FOUND`               | Resource absent — including resources of other organizations                            |
| `VALIDATION_ERROR`        | Input rejected by the server's schema                                                   |
