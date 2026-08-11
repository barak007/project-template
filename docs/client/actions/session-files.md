---
type: Action Namespace
title: sessionFiles
description: Browse the project a work session opened on — one directory and one file at a time, read by the server so a remote project works the same.
resource: ../../../domain-client/session-file-actions.ts
tags: [client, actions, work-sessions, files]
timestamp: 2026-08-11T00:00:00Z
---

# `app.sessionFiles`

The files a [work session](./work-sessions.md) holds: its git project, read as a
tree of text. This is what an editor over a session is built from.

**Nothing here touches a filesystem.** The server reads the project wherever it
actually lives (a directory on the machine that built it today, a bucket later)
and answers with JSON, so a session prepared on a machine the person browsing has
no access to opens exactly the same way. The port is
`domain-server/git/project-files.ts`.

Reads need `resource:read` — a member who may see a session may read its code.

## `openDirectory(organizationId, workSessionId, path = "")`

Reads one folder's children into `state.sessionFiles.directories[path]`. `""` is
the project root; `path` is relative and slash-separated. Git's own `.git`
directory is never listed, and entries come back folders-first.

The tree is expanded **a level at a time**: a repository with thousands of files
costs a click, not a payload. Which folders are open is therefore not a separate
slice — it is which paths have been read.

## `collapseDirectory(path)`

Forgets that folder and everything below it, so re-opening reads fresh. Local
only: no request.

## `openFile(organizationId, workSessionId, path)`

Reads one file into `state.sessionFiles.openFile` as
`{ path, text, truncated }`. A file longer than 512 KB opens **truncated** (its
head, `truncated: true`) rather than being refused; a file that is not text is
`VALIDATION_FAILED`.

## Notes

- State holds **one session's** files ([state](../state.md)): a fact about
  another session starts the tree from nothing rather than mixing two projects.
- Before a session is `"ready"` there is no project, and every read here is
  `VALIDATION_FAILED` — see [work-sessions](./work-sessions.md).
- A path that climbs out of the project — `..`, an absolute path, a symlink
  pointing elsewhere — is `NOT_FOUND`, never a read.
