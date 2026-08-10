---
type: Domain
title: Permission Model
description: How organizations, teams, and workspaces grant access — the roles, the permissions they carry, and the rules for resolving them.
tags: [domain, authorization, teams, workspaces]
timestamp: 2026-08-10T00:00:00Z
---

# Permission Model

This document defines the authorization model for organizations, teams, and
workspaces. It supersedes the Authorization section of
[domain.md](./domain.md), which describes only the organization-level matrix as
implemented today in
[domain-server/services/policy.ts](../domain-server/services/policy.ts).

## Assumptions this design makes

Recorded explicitly so they can be overturned before implementation:

1. **A team is a named group of users inside one organization.** It is not a
   tier above the organization, and it owns nothing.
2. **Workspaces become independently permissioned.** A workspace is
   organization-visible by default; it can be restricted to specific teams and
   users.
3. **Sources and secrets stay organization-scoped.** Teams do not own sources.
4. **Invitations are out of scope.** Members are still added by user id.
5. **Grants are additive.** There is no deny rule and no per-resource
   revocation of an organization role.

## Entities

| Entity                 | Meaning                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Organization**       | The tenant boundary. Owns every source, workspace, secret, and work session.                      |
| **OrganizationMember** | A user's membership in an organization, with exactly one role: `owner`, `admin`, `member`.        |
| **Team**               | A named group of users inside one organization. Names unique per organization.                    |
| **TeamMember**         | A user's membership in a team, with one role: `maintainer` or `member`.                           |
| **WorkspaceGrant**     | An access grant on one workspace to one subject — a team or a user — carrying one workspace role. |

A user reaches a workspace through at most three paths: their organization
role, a grant made directly to them, and a grant made to a team they belong to.

## Roles

### Organization roles

Govern the organization itself and its organization-scoped resources.

| Permission            | owner | admin | member |
| --------------------- | :---: | :---: | :----: |
| `organization:read`   |   ✓   |   ✓   |   ✓    |
| `organization:manage` |   ✓   |       |        |
| `team:manage`         |   ✓   |   ✓   |        |
| `source:read`         |   ✓   |   ✓   |   ✓    |
| `source:write`        |   ✓   |   ✓   |        |
| `secret:manage`       |   ✓   |   ✓   |        |
| `workspace:create`    |   ✓   |   ✓   |   ✓    |

`organization:manage` covers renaming the organization and changing member
roles. `team:manage` covers creating, renaming, and deleting teams and editing
their rosters.

The existing `resource:read` / `resource:write` pair splits into `source:*` and
the workspace roles below. `member` gains `workspace:create` — a member may
create a workspace and becomes its `manager`, which is the point of having
per-workspace roles at all.

### Team roles

A team role governs the team's roster only. It carries no access to workspaces;
access comes from the grants the team holds.

| Permission    | maintainer | member |
| ------------- | :--------: | :----: |
| `team:read`   |     ✓      |   ✓    |
| `team:roster` |     ✓      |        |

`team:roster` is adding and removing members of that one team. Creating and
deleting teams remains `team:manage` at the organization level.

### Workspace roles

Ordered, each strictly containing the one before it.

| Permission         | viewer | operator | editor | manager |
| ------------------ | :----: | :------: | :----: | :-----: |
| `workspace:read`   |   ✓    |    ✓     |   ✓    |    ✓    |
| `session:create`   |        |    ✓     |   ✓    |    ✓    |
| `workspace:write`  |        |          |   ✓    |    ✓    |
| `workspace:manage` |        |          |        |    ✓    |

- `workspace:read` — see the workspace, its name, and its source list.
- `session:create` — materialize a work session from it.
- `workspace:write` — rename it, change which sources it references.
- `workspace:manage` — edit its grants and visibility, delete it.

`operator` exists because running a workspace and editing it are different
jobs: the common case is a group that runs work sessions daily and must not be
able to change what the workspace points at.

## Resolving effective access

Every workspace carries `visibility`, either `organization` (default) or
`restricted`.

Effective workspace role for a user is the **maximum** of every rule that
applies:

```
resolveWorkspaceRole(user, workspace) -> role | none

  membership = organizationMembers(user, workspace.organizationId)
  if not membership          -> none          // 404, not 403; see invariants
  if membership.role in (owner, admin)
                             -> manager       // organization admins always win
  candidates = []
  if workspace.visibility == "organization"
      candidates += viewer                    // every member can look
  candidates += grants where subject == user
  candidates += grants where subject in teams(user)
  return max(candidates) or none
```

Consequences worth stating plainly:

- An organization `owner` or `admin` is a `manager` on every workspace,
  always. A grant can never take that away.
- A `member` with no grant gets `viewer` on organization-visible workspaces —
  which is exactly today's behavior — and nothing on restricted ones.
- A restricted workspace with no grants is reachable only by organization
  owners and admins.
- A user in two teams that both hold grants gets the higher of the two.

## Invariants

1. **Every organization always has at least one owner.** Demoting or removing
   the last owner fails with `VALIDATION_FAILED`. This closes an existing gap:
   `putMembership` today lets an owner demote themselves to `member` and orphan
   the organization.
2. **Grant subjects must belong to the organization.** A team grant requires the
   team to be in the workspace's organization; a user grant requires an
   `organizationMembers` row. Removing someone from the organization removes
   their grants and team memberships.
3. **Cross-organization ids behave as if they do not exist** — `404`, never
   `403`. Unchanged, and it extends to teams, grants, and restricted
   workspaces the caller cannot see.
4. **Grants are additive only.** There is no deny, and no grant lowers an
   organization role.
5. **Secrets are not delegated by workspace grants.** A work session snapshot
   merges organization secrets, so anyone with `session:create` causes those
   secrets to be used — but never to be read. Secret values stay encrypted in
   the snapshot and are never returned by the API, and `secret:manage` remains
   organization-level. Granting `operator` on a workspace must never become a
   path to reading a secret.
6. **Authorization lives in services, never in middleware.** Middleware
   establishes identity only. Unchanged from AGENTS.md rule 2.
7. **The organization is resolved from the request path**, never from session
   state, and every organization-scoped query also filters on it. Unchanged.

## Migration semantics

The model is designed so that turning it on changes nobody's access:

- `workspaces.visibility` defaults to `organization`.
- No teams and no grants exist after migration.
- Under those conditions the resolution above reduces exactly to the current
  matrix: owner/admin get full workspace access, members get read.

The one intentional behavior change is `member` gaining `workspace:create`. If
that is unwanted, drop `workspace:create` from the `member` row and the model
is strictly backward compatible.

## What this implies in code

Sketched here for the implementation pass, not prescribed in detail.

**Schema** — [domain-server/db/schema.ts](../domain-server/db/schema.ts), one
migration regenerated with `pnpm db:generate`:

- enums `team_role` (`maintainer`, `member`), `workspace_role` (`viewer`,
  `operator`, `editor`, `manager`), `workspace_visibility` (`organization`,
  `restricted`), `grant_subject` (`team`, `user`)
- `teams` — `id`, `organizationId` cascade, `name`, unique `(organizationId, name)`
- `team_members` — composite PK `(teamId, userId)`, `role`, index on `userId`
- `workspace_grants` — `workspaceId` cascade, `subjectKind`, `subjectId`,
  `role`; unique `(workspaceId, subjectKind, subjectId)`
- `workspaces.visibility` — not null, default `organization`

`subjectId` is polymorphic (`teams.id` is a uuid, `user.id` is text), so it
cannot carry a foreign key. Invariant 2 is therefore enforced in the service
plus a cleanup on member removal — worth noting as the one place the database
does not enforce the model for us.

**Policy** — [domain-server/services/policy.ts](../domain-server/services/policy.ts)
keeps its shape (a static matrix plus a guard that throws `AppError("FORBIDDEN", …, 403)`)
and gains a second entry point:

- `requireOrganizationPermission(db, userId, organizationId, permission)` — as
  today, with the widened `Permission` union
- `requireWorkspacePermission(db, userId, organizationId, workspaceId, permission)`
  — loads membership, visibility, and grants, resolves the role, and throws
  `404` when the workspace is invisible rather than `403`

**Services** — `workspaces.ts` swaps `resource:*` for the workspace guard;
`listWorkspaces` filters to visible workspaces rather than guarding a whole-org
read; `sources.ts` / `values.ts` move to `source:*`; `work-sessions.ts` moves to
`session:create`; new `teams.ts` and workspace-grant operations.

**Surface** — routes under `/organizations/:organizationId/teams` and
`/organizations/:organizationId/workspaces/:workspaceId/grants`, entity schemas
in [domain-server/entities/](../domain-server/entities/), client action
namespaces mirroring them, and the matching pages under
[docs/client/actions/](./client/actions/).

**Tests** — AGENTS.md requires the authorized path, the `403`, and the
cross-organization `404` per endpoint. This model adds two cases worth covering
directly rather than only through routes: the resolution function itself (a
`policy.test.ts`, which does not exist today) and the last-owner invariant.
