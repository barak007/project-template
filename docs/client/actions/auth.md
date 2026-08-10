---
type: Action Namespace
title: auth
description: Sign up, sign in, and sign out against Better Auth's email/password flow.
resource: ../../../domain-client/auth-actions.ts
tags: [client, actions, auth]
timestamp: 2026-08-06T00:00:00Z
---

# `app.auth`

Sessions are cookie-based (Better Auth); the [Host](../host.md) fetch carries
the cookie, so no tokens are handled in client code.

## `loadSession()`

Asks the server who this device is. The session cookie outlives the core, so
a freshly constructed client (a page reload) starts `anonymous` until this
resolves: it dispatches `signed-in` when the cookie still names a user, and
`signed-out` otherwise. Call it once at boot, before deciding what to render.

## `signUp({ email, password, name })`

Creates the account and signs in. On success dispatches `signed-in` —
`state.auth` becomes `{ status: "authenticated", user }`.

## `signIn({ email, password })`

On success: `signed-in`. On failure: **state, not a throw** — dispatches
`sign-in-failed`, leaving
`state.auth = { status: "anonymous", error: { code, message } }`. See the
[error contract](../errors.md).

## `signOut()`

Ends the server session and dispatches `signed-out`, which resets the
**entire** [state tree](../state.md) — organizations, slices, user values,
everything. Other devices' sessions are unaffected.

## Story

```ts
await app.auth.loadSession(); // still anonymous
await app.auth.signUp({ email, password, name: "Ada" });
await app.organizations.create({ name: "Analytical Engines" });
await app.auth.signOut(); // state fully reset
await app.auth.signIn({ email, password });
await app.organizations.load(); // it's still there
```
