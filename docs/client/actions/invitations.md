---
type: Action Namespace
title: invitations
description: Offer someone access to an organization by email — the inviting half of the only way in.
resource: ../../../domain-client/invitation-actions.ts
tags: [client, actions, members, invitations, permissions]
timestamp: 2026-08-12T00:00:00Z
---

# `app.invitations`

An invitation is an offer addressed to an **email address**, and it grants
nothing. The membership is written when the invited person accepts it from their
own [inbox](./inbox.md), so nobody is put in an organization without agreeing to
be there — and a mistyped address cannot let anyone in.

Owner-only, all three actions: everything here needs `organization:manage`.

## `load(organizationId)`

Loads every invitation the organization has ever sent into
`state.invitations`, newest first. Each carries `email`, `role`, `status`
(`pending` | `accepted` | `declined` | `revoked`) and `respondedAt`.

## `invite(organizationId, { email, role })`

Sends one. The address is trimmed and lower-cased by the server, so
`Ada@Example.com` and `ada@example.com` are the same person.

- The address **does not need an account**. If it has one, the invitation is put
  in that user's inbox immediately; if not, it is delivered the first time they
  read their inbox after signing up.
- Re-inviting an address that is already waiting **changes the role offered**
  rather than creating a second offer.
- Inviting someone who is already a member fails with `CONFLICT`.
- The mail itself goes through the server's `Mailer` boundary. With no provider
  configured it is logged rather than sent — the invitation still exists and is
  still answerable in the app.

## `revoke(organizationId, invitationId)`

Withdraws an unanswered offer: its status becomes `revoked` and it is no longer
answerable. Revoking anything already answered is a `NOT_FOUND`.

## Related

- [inbox](./inbox.md) — the invited person's side, and where accepting happens
- [members](./members.md) — the roster, and changing a role once someone is in
