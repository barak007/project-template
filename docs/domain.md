# Domain Model

The entities this service implements, and the rules that govern them. Engineering conventions live in [AGENTS.md](../AGENTS.md); setup and operations live in [README.md](../README.md) and [deployment.md](./deployment.md).

Persistence is defined in [domain-server/db/schema.ts](../src/db/schema.ts) and request/response shapes in [domain-server/entities/](../src/entities/). This document describes the meaning those definitions encode; the code is the source of truth for field-level detail.

## Entities

- **Organization** — a group of users that owns sources, workspaces, and work sessions. Every organization-owned record carries an `organizationId`.
- **User** — an individual who can belong to many organizations. Users also own personal secrets and data that exist outside any organization.
- **OrganizationMember** — the membership record joining a user to an organization with one role: `owner`, `admin`, or `member`.
- **Source** — a definition of a git repository, database, or other external data source (`kind`: `git` | `database` | `other`) plus a JSON `config`. Names are unique within an organization. A `git` source is a remote URL: its `config` is validated as `{ remote, ref? }`, nothing has to exist on any machine for one to be defined, and adding the same remote twice returns the source that already exists. The product calls these **repositories**; the word "source" never reaches the UI.
- **Workspace** — a named set of sources within an organization, used as the template for a work session. Names are unique within an organization. Every referenced source must belong to the same organization.
- **WorkSession** — the result of materializing a workspace. Created by copying the workspace's sources and the caller's resolved secrets and data into an immutable snapshot, then materializing asynchronously into a **git project** whose submodules are the snapshot's git sources. `projectLocation` records where that project was built and `projectBranch` which branch its repositories are on; both are null until the session is `ready`.
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
4. The worker claims the session by moving `pending` → `materializing`, builds the git project, then records its location and moves to `ready`. A session it cannot claim is already handled, and the project path is derived from the session id so a retried build replaces its own half-finished work — both of which make retries idempotent. A build that throws leaves the session `failed` with `failureCode: PROJECT_BUILD_FAILED`; exhausted retries land in a dead-letter queue.

Statuses: `pending` → `materializing` → `ready`, or `failed` with a `failureCode`.

**Snapshot resolution.** Organization values and the creating user's values are merged by key, and **user values win on conflict**. Secret values are copied into the snapshot still encrypted; consumers decrypt them at use time, so secrets stay encrypted at rest everywhere. The snapshot is taken at creation, so later edits to a source, secret, or data value affect only future sessions — never an existing one. Source-specific materialization behavior is an extension point for apps built on this service; the base implementation only advances status.

## The workspace git project

Materializing a session builds a git repository whose tree is the session's
snapshot made real: one submodule per git source, every one checked out on a
named branch rather than detached. Where it is built is a port, not a path:
[domain-server/git/project-builder.ts](../domain-server/git/project-builder.ts)
defines `build` and `branchAll`, and the runtime injects the implementation this
deployment can use — a directory on this machine today, a bucket in the cloud.
Neither the services nor the routes know which.

`projectLocation` is therefore a shape (`{ kind: "local", path }` or
`{ kind: "s3", bucket, prefix }`), and a command addressed at a project the
current builder cannot reach is a `VALIDATION_FAILED` rather than a crash.

Cloning uses whatever git credentials the machine already has, so no token
reaches the server. See [sessions.md](./sessions.md) for why there are no
connection entities yet.

## Extension points

A client application, additional identity providers, further project builders
(a bucket, a remote host), and real per-`kind` source materializers beyond git
are intentionally left to each app built from this boilerplate.
