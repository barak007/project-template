---
type: Action Namespace
title: projectFiles
description: Browse a git project — a workspace's own, or a session's clone of it — one directory and one file at a time, read by the server so a remote project works the same.
resource: ../../../domain-client/project-file-actions.ts
tags: [client, actions, projects, files]
timestamp: 2026-08-11T00:00:00Z
---

# `app.projectFiles`

The files of a git project, read as a tree of text. This is what an editor over
a project is built from, and there are two projects to read:

| Target                      | What it is                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `{ kind: "workspace", id }` | the [workspace](./workspaces.md)'s own project — the **template** holding its repositories as submodules |
| `{ kind: "session", id }`   | a [session](./work-sessions.md)'s clone of that template                                                 |

The target is a value rather than two namespaces because the two reads are the
same read; only the row that says where the project lives differs.

**Nothing here touches a filesystem.** The server reads the project wherever it
actually lives (a directory on the machine that built it today, a bucket later)
and answers with JSON, so a project built on a machine the person browsing has no
access to opens exactly the same way. The port is
`domain-server/git/project-files.ts`.

Reads need `resource:read` — a member who may see a workspace may read the code
it works on.

## `openDirectory(organizationId, target, path = "")`

Reads one folder's children into `state.projectFiles.directories[path]`. `""` is
the project root; `path` is relative and slash-separated. Git's own `.git`
directory is never listed, and entries come back folders-first.

The tree is expanded **a level at a time**: a repository with thousands of files
costs a click, not a payload. Which folders are open is therefore not a separate
slice — it is which paths have been read.

## `collapseDirectory(path)`

Forgets that folder and everything below it, so re-opening reads fresh. Local
only: no request.

## `openFile(organizationId, target, path)`

Reads one file into `state.projectFiles.openFile` as
`{ path, text, truncated }`. A file longer than 512 KB opens **truncated** (its
head, `truncated: true`) rather than being refused; a file that is not text is
`VALIDATION_FAILED`.

## Notes

- State holds **one project's** files ([state](../state.md)): a fact about
  another target starts the tree from nothing rather than mixing two projects.
- Neither project exists before the workspace's **first session** builds it — a
  workspace with `projectLocation: null`, or a session that is not yet `"ready"`,
  answers `VALIDATION_FAILED`.
- A path that climbs out of the project — `..`, an absolute path, a symlink
  pointing elsewhere — is `NOT_FOUND`, never a read.
