---
type: Action Namespace
title: inbox
description: What is addressed to the signed-in user personally, and their answer to it.
resource: ../../../domain-client/inbox-actions.ts
tags: [client, actions, inbox, invitations]
timestamp: 2026-08-12T00:00:00Z
---

# `app.inbox`

The signed-in user's own messages. Identity-scoped, not organization-scoped:
an [invitation](./invitations.md) arrives from an organization the user cannot
see yet, which is the whole point — accepting is what gives them access.

## `load()`

Loads `state.inbox`, newest first. Each row is
`{ id, kind, readAt, createdAt, invitation }`, where `invitation` carries what a
UI needs to write the sentence: `organizationName`, `role`, `status`,
`invitedByName`.

Reading also **delivers**: a pending invitation addressed to this user's email
that has no message row yet gets one here. That is how an invitation sent before
its recipient had an account is waiting for them after they sign up — there is no
hook into sign-up and nothing to reconcile later.

## `respond(invitationId, "accept" | "decline")`

Answers one. Accepting is the only thing in the system that creates a
membership, with the role the invitation offered.

- Authorization is the address: the invitation is answerable only by whoever is
  signed in as the email it names. Anyone else gets `NOT_FOUND`, not `FORBIDDEN`
  — someone else's invitation is not theirs to know about.
- Answering twice, or answering something revoked, is a `CONFLICT`.
- The answered row **stays** in the inbox with its new status, so the click has
  something to say. The app layer also reloads `organizations` after an accept,
  so the organization just joined appears where the user is looking.

## Related

- [invitations](./invitations.md) — the inviting side
- [state](../state.md) — `inbox` is a user-scoped slice, unaffected by switching organizations
