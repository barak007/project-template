---
type: Domain
title: Work Session Creation
description: The end-to-end flow from defining a repository to opening a session on a folder — local first, cloud later — with the decisions it forced and the order it gets built in.
tags: [domain, sessions, git, github, runtime]
timestamp: 2026-08-10T00:00:00Z
status: agreed — steps 1 to 3 built against a local project builder; the agent and the cloud are next
---

# Work Session Creation

The story, the decisions it forced, and the order they get built in. The
entities it touches are defined in [domain.md](./domain.md) and the access
rules in [permissions.md](./permissions.md).

Steps 1 to 3 are built. A workspace collects repository URLs, and pressing
**Create session** snapshots them and builds a git project holding each one as
a submodule, on this machine
([local-project-builder.ts](../domain-server/git/local-project-builder.ts)).
Step 4 — the agent, and the cloud — is untouched.

## The story

1. The user **defines the repositories** they work on: a git remote URL each.
   Nothing is connected, installed, or discovered first.
2. On a **workspace page** the user collects **which repos** belong together.
3. The workspace page has a **Create session** button. Pressing it:
   - snapshots the workspace, then builds a **git project containing the
     workspace's repos as submodules** — the session's _workspace git project_,
   - records **where that project lives**, and
   - offers **commands over the project**, starting with putting every repo on
     one branch.
4. **We start local.** The project is a directory on the machine running the
   server; the cloud is the same port writing to a bucket.

## Decisions

Settled. Each was an open question; the reasoning is kept because the
alternatives are all defensible.

**A repository is a definition, not a discovery.** A repository is a remote URL
and nothing more. Nothing needs an account, a token, or a folder on any machine
for one to exist — cloning happens when a session materializes it. This
replaces an earlier design where a _connection_ exposed a catalogue of
repositories and importing one created the source: that made a repository
downstream of scanning some machine, which is backwards. Discovery may come back
as a **convenience** for picking a URL from GitHub; it will never again be how a
repository comes into being.

**There are no connections yet.** Cloning uses the git credentials the machine
already has, so the server never holds a token, which is the simplest thing that
preserves invariant 5 in [permissions.md](./permissions.md). A `connections`
entity — and `connection:manage` — comes back when the server itself must
authenticate to a host, not before. Migrations here squash into a single
`0000_init`, so re-adding it is a regeneration, not a migration chain.

**Repositories stay `kind: "git"` sources.** Not because the user thinks in
sources — they never see the word — but because `sourcesSnapshot` is what makes
a work session immutable, and that machinery already exists. A git source's
`config` is validated as `{ remote, ref? }`
([entities/source.ts](../domain-server/entities/source.ts)) rather than left as
free JSON, because the builder clones it: a URL that cannot be cloned should
fail the request, not the session.

**Submodules, not a manifest** — _reversing an earlier decision_. The manifest
was chosen because submodules check out detached HEAD, so the first thing a user
does — edit a file and commit — does not work as they expect. Submodules win
anyway: the project should be an exact, reproducible reflection of the workspace
config, and a manifest plus a clone script is a convention that can drift from
it while a submodule commit cannot. The detached-HEAD cost is paid off rather
than accepted: the builder leaves every submodule **on a named branch**, and
`branchAll` re-does that on demand, which is why
[local-project-builder.test.ts](../domain-server/tests/local-project-builder.test.ts)
asserts on the current branch of each submodule. The remaining cost stands:
cloning private submodules needs credentials for each, which is the machine's
problem while we are local.

**The project is per session, not per workspace** — _also reversing an earlier
decision_. Per workspace was chosen for idempotence, so that pressing the button
twice did not create two repositories. Per session matches `sourcesSnapshot`,
which is already per session and already immutable: a session is a frozen
config, and its project is that config realized. Idempotence comes from the path
instead — it is derived from the session id, so a retried job rebuilds in place
([local-project-builder.ts](../domain-server/git/local-project-builder.ts)).

**Where the project lives is data, not a path.** `work_sessions.project_location`
is a shape — `{ kind: "local", path }` today, `{ kind: "s3", bucket, prefix }`
when this runs on AWS — because the answer changes per installation while
everything above the port stays the same.

**Local sessions are built by the server.** The server writes the project
directly, which is valid only because "we start local" means it shares a machine
with the person using it. A deployed installation cannot do this, which is what
step 4's agent is for.

## Onboarding

Simplicity is measured in decisions between "I signed up" and "my repositories
are open in a folder". The target is three user actions: sign in → paste
repository URLs → create session.

- **The organization is created implicitly.** On first sign-in, a personal
  organization named after the user, with an `owner` membership —
  `createOrganization` already does organization and membership atomically. The
  concept surfaces only when they invite someone.
- **Creating a workspace and adding repositories are one screen**, with the
  name pre-filled and editable inline.
- **The word "source" never appears in the app.** They are repositories.
- **A repository's name is derived, never a form**: the last path segment of the
  URL, with `-2` appended if that name is taken
  ([services/repositories.ts](../domain-server/services/repositories.ts)).
- **The clone directory is a convention**, `~/wwsa/<workspace>/<session>`, set
  by `WORK_SESSION_PROJECT_ROOT` and shown but never a blocking prompt.
- **Statuses read as _Preparing → Ready_.** "Materialize" stays internal to
  [materialize.ts](../domain-server/jobs/materialize.ts).

## Still open

- **What does "open our session view on that folder" mean concretely** — an
  editor, a local process serving a UI, something else?
- **Which commands beyond `branchAll` does a project need** — commit across
  submodules, push, pull, status? One exists because one was needed; the shape
  of the rest is unknown until a user asks.
- **Where does this code live?** [AGENTS.md](../AGENTS.md) frames this repo as
  a boilerplate apps are generated from, and [domain.md](./domain.md) leaves
  per-`kind` materializers to each app. A submodule project is arguably a
  product feature; `domain-server` holds it today because the generic
  materializer port and the only implementation arrived together.
- **Does a `member` need to create sessions?** Building a project is
  `resource:write`, so a `member` pressing **Create session** gets a `403`
  today. That is defensible while the project is local, and needs revisiting
  when it is not.

## Build order

1. ~~**The workspace page**~~ — done: a route, and repository URLs on it.
2. ~~**The repository definition**~~ — done: `addRepository`, idempotent on the
   remote, validated as a cloneable URL.
3. ~~**A real materializer port**~~ — done:
   [project-builder.ts](../domain-server/git/project-builder.ts) is the port,
   injected on `RuntimeDependencies`, with the local implementation and the
   `branchAll` command. Press the button and a real project appears on disk.
4. **The local agent** — device pairing, claim, clone. Larger than 1–3
   together, and it needs a session state beyond today's four: `ready` has to
   mean "built, awaiting a device", with a second transition when the clone
   lands. **Also what makes the cloud possible**, since the server writing to
   the user's filesystem is exactly what does not survive deployment.
5. **GitHub as a connection** — only once something server-side must
   authenticate: pushing the project, or listing repositories to pick from. The
   credential needs its own encrypted column through the `SecretCipher` already
   on `RuntimeDependencies`, stripped from the response schema so it can never
   be serialized by accident — the rule `organizationSecrets` already follows.

Teams and workspace grants ([permissions.md](./permissions.md)) are **not** a
prerequisite; today's owner/admin/member matrix gates all of this.
