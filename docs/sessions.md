---
type: Domain
title: Work Session Creation
description: The end-to-end flow from connecting GitHub to opening a session on a folder — local first, cloud later — with the decisions it forced and the order it gets built in.
tags: [domain, sessions, git, github, runtime]
timestamp: 2026-08-10T00:00:00Z
status: agreed — steps 1 and 2 built for the local provider; GitHub pending credentials
---

# Work Session Creation

The story, the decisions it forced, and the order they get built in. The
entities it touches are defined in [domain.md](./domain.md) and the access
rules in [permissions.md](./permissions.md).

Steps 1 and 2 are built, against a **local** git provider rather than GitHub:
an organization connects a folder on this machine and a workspace picks
repositories out of it. GitHub is the same port with different credentials.
Steps 3 and 4 are untouched —
[work-sessions.ts](../domain-server/services/work-sessions.ts) still only
snapshots and advances status.

## The story

1. The user **connects GitHub** once. The connection is organization-scoped.
2. On a **workspace page** the user picks **which git repos** belong to that
   workspace, choosing from the repos the connection exposes.
3. The workspace page has a **Create session** button. Pressing it:
   - builds a **git project containing the workspace's repos as submodules** —
     the user's _workspace setup project_,
   - **pushes it to the user's git**,
   - then, depending on the platform:
     - **local** — clone that project into a new directory and open our session
       view on that folder;
     - **cloud** — allocate a machine and do the same there.
4. **We start with local.** Cloud comes second, behind the same abstraction.

## Decisions

Settled. Each was an open question; the reasoning is kept because the
alternatives are all defensible.

**The GitHub connection is not a source.** A connection is a credential, and
sources are readable by every `member` (`source:read`) — connection tokens must
not be. It becomes its own organization-scoped entity, gated by a new
`connection:manage` permission alongside `secret:manage`.

**Repositories stay `kind: "git"` sources.** Not because the user thinks in
sources — they never see the word — but because `sourcesSnapshot` is what makes
a work session immutable, and that machinery already exists. The workspace page
upserts sources behind a repository picker; there is no source form in the app.

**Connecting is an explicit button, separate from signing in.** Signing in with
GitHub would not remove a step, because the App installation is required
either way; it would only remove the sign-up form. Against that:

- the connection is **organization-scoped** while login is user-scoped — one
  user works in many organizations, each needing its own installation, possibly
  on a GitHub organization account that is not their personal login;
- the button must exist regardless, for reconnecting, revoking, and changing
  which repositories the installation covers;
- it keeps the provider swappable — GitLab later is another connection, not
  another login system;
- an organization-level installation **outlives the person who created it**.

Email and password stay as the sign-in. Offering GitHub as _one_ sign-in option
later remains open; it just is not the connection.

**A manifest, not submodules.** Submodules check out detached HEAD, so the
first thing a user does — edit a file and commit — does not work the way they
expect, and cloning private submodules needs credentials for each. A manifest
plus a clone script has no such surprise. Submodules remain the better answer
if exact-commit reproducibility ever outweighs day-to-day ergonomics.

**The setup project is per workspace, not per session.** It matches "his
workspace setup project", makes creation idempotent, and leaves a session as a
commit or branch of it. Per session would create a repository on every press.

**Local sessions are materialized in two halves.** The server cannot write to
the user's filesystem. It prepares and pushes the setup project; an agent on
the user's machine claims the session and clones it. The agent uses **the
user's own git credentials**, so the server never hands a token to a client —
which preserves invariant 5 in [permissions.md](./permissions.md).

## Onboarding

Simplicity is measured in decisions between "I signed up" and "my repositories
are open in a folder". The target is four user actions, two of them on
GitHub's own screens: sign in → connect GitHub and pick repositories → create
session → paste one command.

- **The organization is created implicitly.** On first sign-in, a personal
  organization named after the user, with an `owner` membership —
  `createOrganization` already does organization and membership atomically. The
  concept surfaces only when they invite someone.
- **Permissions are requested when they pay off.** The GitHub installation is
  triggered the first time repositories are actually needed, with the user's
  intent preserved so they resume rather than restart — not demanded at
  sign-up.
- **Creating a workspace and picking repositories are one screen**, with the
  name pre-filled and editable inline.
- **The word "source" never appears in the app.** They are repositories.
- **The setup repository is derived, never a form**: owner is the account the
  installation is on, name is `wwsa-<workspace-slug>`, private, created on
  demand. Ask only on a name collision.
- **Pairing the agent is one copy-paste** — `npx wwsa pair ABCD-1234`, the
  page polls and advances itself — and the agent's first run executes the
  pending session, so installing it and getting the first session are one act.
- **The clone directory is a convention**, `~/wwsa/<workspace>/<session>`,
  shown but never a blocking prompt.
- **The setup repository is shown in the web UI** once pushed, so a user who
  never installs the agent still got something real.
- **Statuses read as _Preparing → Ready_.** "Materialize" stays internal to
  [materialize.ts](../domain-server/jobs/materialize.ts).

Consequences accepted deliberately: connecting is `connection:manage`, so a
`member` pressing **Create session** on an unconnected organization must get
_"Ask an admin to connect GitHub"_ rather than a dead button or a permission
error; and implicitly created organizations will need a story for moving a
workspace into a shared one later.

## Still open

- **Does `session:create` now imply pushing to the organization's GitHub?**
  Under [permissions.md](./permissions.md) a workspace `operator` may create
  sessions. If that pushes a repository, it is more authority than
  `session:create` reads like today.
- **What does "open our session view on that folder" mean concretely** — an
  editor, a local process serving a UI, something else?
- **Where does this code live?** [AGENTS.md](../AGENTS.md) frames this repo as
  a boilerplate apps are generated from, and [domain.md](./domain.md) leaves
  per-`kind` materializers to each app. GitHub credentials and manifest
  generation are product features; `domain-server` should gain only a generic
  materializer port.

## Build order

1. ~~**The workspace page**~~ — done: a route, and repository selection on it.
2. **The connection** — done for `local`
   ([git/provider.ts](../domain-server/git/provider.ts) is the port,
   [local-provider.ts](../domain-server/git/local-provider.ts) reads
   repositories out of a folder on this machine). **GitHub is what remains**:
   registering the App, storing the installation credential, and adding a
   `github` entry to the registry. Nothing above the port changes.

   **`connections` has no credential column, deliberately.** Its `config` is
   plaintext JSON readable by anyone with `resource:read` — a root path for
   `local`, which is not a secret. A GitHub installation token is, so it
   cannot go in `config`: it needs its own column, encrypted through the
   `SecretCipher` already on `RuntimeDependencies`, and stripped from
   `connectionResponseSchema` so it can never be serialized by accident —
   the rule `organizationSecrets` already follows. The column was left out
   rather than added empty, because guessing GitHub's shape before touching
   its API would ship a field no code reads and no test proves is withheld.
   Migrations here squash into a single `0000_init`, so adding it later is a
   regeneration, not a migration chain.

3. **A real materializer port** — injected on `RuntimeDependencies`, so the
   job can do git work and tests can stub it. Steps 1–3 are verifiable
   end-to-end with no agent and no cloud: press the button, a setup repository
   appears.
4. **The local agent** — device pairing, claim, clone. Larger than 1–3
   together, and it needs a session state beyond today's four: `ready` has to
   mean "pushed, awaiting a device", with a second transition when the clone
   lands.

Teams and workspace grants ([permissions.md](./permissions.md)) are **not** a
prerequisite; today's owner/admin/member matrix gates all of this.
