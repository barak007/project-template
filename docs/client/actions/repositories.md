---
type: Action Namespace
title: repositories
description: Defining a repository by its git URL, as the source a workspace references.
resource: ../../../domain-client/repository-actions.ts
tags: [client, actions, repositories, git]
timestamp: 2026-08-10T00:00:00Z
---

# `app.repositories`

A repository is a **definition**: a git remote URL, and optionally the ref a
session starts from. Nothing has to be connected, installed, or present on any
machine for one to exist — cloning happens when a
[work session](./work-sessions.md) materializes it.

Adding one creates a `kind: "git"` [source](./sources.md) the organization owns,
which is what a [workspace](./workspaces.md) references and a work session
snapshots. There is no `load` here and no separate collection: repositories
**are** `state.sources`, read through [sources](./sources.md).

## `add(organizationId, { remote, ref? })`

Defines the repository and **returns the source**, upserting it into
`state.sources`. Requires `resource:write`.

Adding is **idempotent on `remote`**: a URL the organization already has returns
the existing source rather than creating a second one, so the same repository in
two workspaces is one definition. That is why this dispatches `repository-added`
and not `source-created`.

The name is derived, never given — the URL's last path segment without `.git`
(`bar` from `…/foo/bar.git`), with `-2` appended when that name is taken, since
two different repositories can end in the same segment.

## Notes

- The product word is **repository**. "Source" is how the server stores one, and
  the app never shows it.
- `remote` must be a URL git can clone: `https://`, `http://`, `git://`,
  `ssh://`, or the scp-like `git@host:owner/repo.git`. A local path is rejected —
  a repository is not a folder on the server's machine — and so are `file://`
  and `ext::`, which would let a URL choose a program to run. Anything else is
  `VALIDATION_FAILED`.
- The app layer's `add` reads the URL from `state.repositoryDraft` and also
  attaches the result to the workspace; this namespace only defines it.
