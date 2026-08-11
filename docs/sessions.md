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

Steps 1 to 3 are built. A workspace collects repository URLs; pressing **Create
session** ensures the workspace's git project exists and clones it for the
session, on this machine
([local-project-builder.ts](../domain-server/git/local-project-builder.ts)).
Step 4 — the agent, and the cloud — is untouched.

## The story

1. The user **defines the repositories** they work on: a git remote URL each.
   Nothing is connected, installed, or discovered first.
2. On a **workspace page** the user collects **which repos** belong together.
3. The workspace page has a **Create session** button. Pressing it:
   - snapshots the workspace,
   - **builds the workspace git project** if it does not exist — one submodule
     per repository, declared and pinned, never cloned — or **reuses and
     reconciles** it if it does,
   - **clones that project** into a new directory for this session, submodules
     and all, on the session's own branch,
   - records **where both live**, and
   - offers **commands over the session's project**, starting with putting every
     repository on one branch.
4. **We start local.** Both are directories on the machine running the server;
   the cloud is the same port writing to a bucket.

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

**One project per workspace, one clone per session.** The two candidates —
project per workspace, or project per session — are both half right, and the
answer is both: the **workspace** owns a git project holding its repositories as
submodules, and a **session** is a `git clone --recurse-submodules` of it into a
fresh directory. Sharing one directory between sessions would mean two sessions
editing the same working tree; the project exists so every session starts from
one agreed-on structure and one agreed-on commit per repository.

**The project declares, it does not check out.** Nothing is cloned into the
project: a repository becomes a `.gitmodules` entry plus a gitlink at the commit
`git ls-remote` says its ref points at, written with `update-index --cacheinfo`,
which needs no object present. That is what makes a workspace cheap to keep
correct — adding, removing or re-pointing a repository is a config edit and one
`ls-remote`, not a clone — and it is why reconcile stages only `.gitmodules`:
`add --all` would read those gitlinks as deleted directories. The cost is that
each session fetches the repositories from their hosts rather than copying them
off disk, which is the price of a project that is always allowed to be wrong for
free.

Session directories live beside the project (`<workspace>/project` and
`<workspace>/sessions/<id>`) so everything for one workspace is in one place, and
the session path is derived from the session id, so a retried job throws away its
own half-finished clone rather than repairing it.

**A reused project is reconciled, never trusted.** "It exists, skip it" would
mean a repository added to the workspace today never reaches a session. So
`ensureWorkspaceProject` enforces the structure the product promises — **one
submodule per repository, at a directory named after it, pointing at its remote
and ref** — and corrects anything else: submodules the workspace dropped are
removed (including any `.git/modules` entry left by a project built when the
project still cloned, or re-adding the same name later fails), new ones added,
changed remotes and refs re-pointed and re-pinned.

**Where a project lives is data, not a path.** `workspaces.project_location` and
`work_sessions.project_location` are a shape — `{ kind: "local", path }` today,
`{ kind: "s3", bucket, prefix }` when this runs on AWS — because the answer
changes per installation while everything above the port stays the same.

**A session says what it is doing, in the database.** `work_sessions.progress`
is an append-only trail of steps written _while_ the work runs, so "what is
happening right now" is answerable from the API. A terminal log only helps
whoever can see the terminal, and the failure it was written for — a session
stuck on "Preparing…" — is indistinguishable from a slow clone without it. It is
appended with `jsonb ||` rather than read-modify-write, and a failure to record
progress never fails the session it describes.

**The worker runs inside `pnpm dev`.** Production keeps two processes
([server.ts](../domain-server/server.ts) and [worker.ts](../domain-server/worker.ts)),
but locally the queue had no consumer at all, so every session sat at
"Preparing…" forever. [dev-app.ts](../domain-server/dev-app.ts) registers the
worker on the runtime it already owns.

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
  `createOrganization` already does organization, membership, and a first
  workspace named after the organization atomically. The concept surfaces only
  when they invite someone.
- **Creating a workspace and adding repositories are one screen**, with the
  name pre-filled and editable inline.
- **The word "source" never appears in the app.** They are repositories.
- **A repository's name is derived, never a form**: the last path segment of the
  URL, with `-2` appended if that name is taken
  ([services/repositories.ts](../domain-server/services/repositories.ts)).
- **The clone directory is a convention**,
  `~/wwsa/<workspace>-<id>/sessions/<session>`, set by
  `WORK_SESSION_PROJECT_ROOT` and shown but never a blocking prompt.
- **Statuses read as _Preparing → Ready_**, with the current step beside them
  ("Cloning notes (2 of 3)") and the trail underneath. "Materialize" stays
  internal to [materialize.ts](../domain-server/jobs/materialize.ts).

## Opening a session

**The session view is a page of the app, and the server does the reading.** A
ready session has its own route
([session-page.tsx](../app/ui/session-page.tsx)): the project's file tree beside
the file being read. The tree is fetched a directory at a time and a file is
fetched when it is opened, both through the API — `project/files` and
`project/file`, over the
[ProjectFiles](../domain-server/git/project-files.ts) port.

**The workspace's own project is browsable the same way**, at
`workspaces/:workspaceId/project/files`, linked from the workspace page. It is
the template a session clones, so seeing what is in it answers "what will my next
session contain" without opening one — and since it is `projectLocation` on a
different row, it is the same read with a different lookup
([services/project-files.ts](../domain-server/services/project-files.ts)). It is
read-only on purpose: work happens in a session, and the template is what
`ensureWorkspaceProject` reconciles.

The alternative — a local process serving a UI over the folder — was rejected
because it makes the browser's machine and the project's machine the same
machine, which is exactly the assumption step 4 and the cloud break. Reading
through the port instead means a session built anywhere opens from anywhere, and
a bucket-backed implementation changes nothing above it.

What that costs, and what it buys:

- **A path from a browser is untrusted.** `..`, an absolute path, and a symlink
  resolving outside the project are all `404`
  ([local-project-files.ts](../domain-server/git/local-project-files.ts));
  the check is on the **real** path, because a link inside the project can point
  anywhere on the machine.
- **Reading is `resource:read`**, unlike building: a member who may see a session
  may read the code it opened on, and creating one still needs write.
- **Text only, and only so much of it.** A file over 512 KB opens truncated and a
  file with a NUL byte in its head is refused, so a viewer never has to render
  something no one can read.
- **`.git` is never listed.** It is machinery, not the work.

Editing is not part of this: the page reads. What a session is for beyond reading
— committing, pushing — stays under the open question about commands below.

## Still open

- **Is reading enough for a session view** — editing a file in the browser means
  writes through the same port, a save model, and a conflict story with whatever
  else has the clone open.
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
   [project-builder.ts](../domain-server/git/project-builder.ts) is the port
   (`ensureWorkspaceProject`, `cloneForSession`, `branchAll`), injected on
   `RuntimeDependencies`, with the local implementation. Press the button and a
   real project appears on disk.
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
