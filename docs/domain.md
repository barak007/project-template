# Domain Model

The entities this service implements, and the rules that govern them. Engineering conventions live in [AGENTS.md](../AGENTS.md); setup and operations live in [README.md](../README.md) and [deployment.md](./deployment.md).

Persistence is defined in [domain-server/db/schema.ts](../src/db/schema.ts) and request/response shapes in [domain-server/entities/](../src/entities/). This document describes the meaning those definitions encode; the code is the source of truth for field-level detail.

## Entities

- **Organization** — a group of users that owns sources, workspaces, and work sessions. Every organization-owned record carries an `organizationId`.
- **User** — an individual who can belong to many organizations. Users also own personal secrets and data that exist outside any organization.
- **OrganizationMember** — the membership record joining a user to an organization with one role: `owner`, `admin`, or `member`.
- **Source** — a definition of a git repository, database, or other external data source (`kind`: `git` | `database` | `other`) plus a JSON `config`. Names are unique within an organization.
- **Workspace** — a named set of sources within an organization, used as the template for a work session. Names are unique within an organization. Every referenced source must belong to the same organization.
- **WorkSession** — the result of materializing a workspace. Created by copying the workspace's sources and the caller's resolved secrets and data into an immutable snapshot, then materializing asynchronously.
- **OrganizationSecret** / **UserSecret** — a key and an encrypted value, at most one per scope and key. Values are encrypted at rest and never returned by the API; reads expose keys and metadata only.
- **OrganizationData** / **UserData** — a key and a schema-validated JSON value available to work sessions, at most one per scope and key.

## Authorization

Membership grants permissions; permissions gate operations. The matrix is defined in [domain-server/services/policy.ts](../src/services/policy.ts).

> This section describes what is implemented today. The agreed target model — teams, and per-workspace grants — is defined in [permissions.md](./permissions.md) and is not yet built.

| Permission            | owner | admin | member |
| --------------------- | ----- | ----- | ------ |
| `organization:read`   | ✓     | ✓     | ✓      |
| `organization:manage` | ✓     |       |        |
| `resource:read`       | ✓     | ✓     | ✓      |
| `resource:write`      | ✓     | ✓     |        |
| `secret:manage`       | ✓     | ✓     |        |

Rules that hold across the domain:

- The active organization is resolved from the request path, never from session state.
- Membership and permission are checked before every read or mutation of an organization-owned resource. No valid session alone grants access to a resource.
- A resource id belonging to another organization behaves as if it does not exist.
- Creating an organization requires authentication but no existing membership; the organization and its creator's `owner` membership are created atomically.
- A user's own secrets and data are governed by ownership, not membership — they are reachable only by that user.

## Work session lifecycle

Creation is synchronous and durable; materialization is asynchronous.

1. The caller must hold `resource:write` in the organization, and the workspace must belong to it.
2. In one transaction, the session records a snapshot of the workspace's sources, the merged data values, and the merged secrets, with status `pending`.
3. A `work-session.materialize` job is enqueued. If enqueueing fails, the session is marked `failed` with `failureCode: QUEUE_UNAVAILABLE`.
4. The worker claims the session by moving `pending` → `materializing`, then to `ready`. A session it cannot claim is already handled, which makes retries idempotent. Exhausted retries land in a dead-letter queue.

Statuses: `pending` → `materializing` → `ready`, or `failed` with a `failureCode`.

**Snapshot resolution.** Organization values and the creating user's values are merged by key, and **user values win on conflict**. Secret values are copied into the snapshot still encrypted; consumers decrypt them at use time, so secrets stay encrypted at rest everywhere. The snapshot is taken at creation, so later edits to a source, secret, or data value affect only future sessions — never an existing one. Source-specific materialization behavior is an extension point for apps built on this service; the base implementation only advances status.

## Extension points

A client application, additional identity providers, and real per-`kind` source materializers are intentionally left to each app built from this boilerplate.
