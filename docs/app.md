# The app

The app is the product the boilerplate ships: a **public website, a sign-up
and a sign-in, and everything else behind the login** — in
[app/](../app/). It is what an app generated from this template starts as, so
it stays deliberately small: replace the copy, add pages, keep the shape.

| Path                                                             | Route                                            | Who sees it |
| ---------------------------------------------------------------- | ------------------------------------------------ | ----------- |
| `/`                                                              | home page                                        | everyone    |
| `/sign-up`                                                       | create an account                                | everyone    |
| `/sign-in`                                                       | sign in                                          | everyone    |
| `/app`                                                           | the user's organizations                         | signed in   |
| `/app/organizations/:id`                                         | one organization's workspaces                    | signed in   |
| `/app/organizations/:id/workspaces/:workspace`                   | one workspace, its repositories and its sessions | signed in   |
| `/app/organizations/:id/workspaces/:workspace/sessions/:session` | one session, as an editor over its files         | signed in   |

## Layout

```
app/
  client/   headless: routes, drafts, guards, actions — no DOM
  ui/       React adapter: one component per page, no logic
  server/   Node-side: the dev-server port and the production static shell
  tests/    router and guard units, plus user stories in Node
```

It **composes the client core, never duplicates it**
([domain-client](client/index.md)): `createAppCore`
([app/client/index.ts](../app/client/index.ts)) builds `createClientCore` for
everything the server owns — authentication, organizations, workspaces — and
adds only what a product front end needs on top:

- **The route**, as a value. [app/client/router.ts](../app/client/router.ts)
  maps routes to and from paths; the store is the source of truth and the URL
  is a projection of it (the routing loop itself is shared with the
  backoffice, in [domain-client/navigation.ts](../domain-client/navigation.ts)).
- **The drafts.** Every form — sign-in, sign-up, new organization, new
  workspace — is a state slice changed by an event, so a flow is testable
  without rendering. No component holds state of its own.
- **The guard.** `visibleRoute` ([selectors.ts](../app/client/selectors.ts))
  is a pure projection, not a redirect: an anonymous visitor on
  `/app/organizations/x` is shown the sign-in page while the URL stays put, so
  signing in lands them where they were going.
- **The failure contract.** `attempt` ([attempt.ts](../app/client/attempt.ts))
  turns a thrown `ApiError` into `state.error`, because a UI cannot handle a
  throw. An expired session is not a message: it re-resolves the session,
  which shows the sign-in page again.

## Repositories

A workspace names the repositories a work session opens together. The product
word is **repository**; the server stores them as `kind: "git"`
[sources](client/actions/sources.md) and a session snapshots that list, but the
app never shows the word "source".

One step, on one page: paste a git URL into the workspace page's field. Nothing
is connected first — a repository is a definition, not something discovered on a
machine (see [sessions.md](./sessions.md)).

`core.repositories.add` ([repository-actions.ts](../app/client/repository-actions.ts))
does both halves of adding: it defines the repository as a source, then rewrites
the workspace's list. Attaching and detaching are a full `workspaces.update`,
since the server takes a replacement rather than a patch. The URL being typed is
`state.repositoryDraft` — a store slice, not `useState`, so the whole flow
(type → submit → error or a cleared field) is testable without rendering.

## Work sessions

**Create session** on the workspace page starts a
[work session](client/actions/work-sessions.md), which a worker prepares by
cloning the workspace's git project. Each session shows its status, the step it
is on right now, and the trail of steps taken — `state.workSessions[].progress`,
so the page never has to say only _Preparing…_ without saying why. It polls
`workSessions.refreshPending` while any session is unfinished; the decision about
what to poll lives in the core
([work-session-actions.ts](../app/client/work-session-actions.ts)), not in the
component.

The list is filtered and derived **during render**, never in a selector: a
`filter` builds a fresh array on every call, and `useSyncExternalStore` reads a
new reference as a changed snapshot.

## Projects

Two pages are an editor over a git project: a ready **session**
([session-page.tsx](../app/ui/session-page.tsx)) over its own clone, and the
**workspace project** ([workspace-project-page.tsx](../app/ui/workspace-project-page.tsx))
over the template every session clones — linked from the workspace page, and
empty until the first session builds it. They share
[workbench.tsx](../app/ui/workbench.tsx): the file tree beside the open file.

Every byte comes from the API through
[projectFiles](client/actions/project-files.md): **the app never assumes the
project is on the machine the browser is running on**, because the server that
built it may be somewhere else entirely. Which project is being read travels as a
target value, so one set of actions and one state slice serve both pages. A
folder in the tree is one control, so opening and closing is one action
(`projectFiles.toggleDirectory`) whose branch is decided from state, not by the
component; and the tree loads a level at a time, so a big repository costs a
click rather than a payload.

## Entity identity

Each domain entity has **one colour and one glyph**, defined once:
`--entity-organization`, `--entity-workspace`, `--entity-project`,
`--entity-session` and `--entity-repository` in
[styles.css](../app/ui/styles.css), drawn by
[entity-icon.tsx](../app/ui/entity-icon.tsx). The icons are inline SVG stroked
with `currentColor`, so the colour comes from the token on the class and never
from a component; an organization in a card, in a breadcrumb and in a heading are
one visual identity rather than three pieces of text.

The two stores are exposed as one tree with one subscription
([store.ts](../app/client/store.ts)) — the app's slices layered over the
client core's.

## Sign-in sessions

Better Auth's cookie outlives the page, so a reload starts anonymous until
`session.load()` (→ `auth.loadSession()`) has asked the server who this
browser is. Until it answers, `state.sessionResolved` is false and the UI
renders nothing — otherwise a signed-in visitor would watch the marketing
page flash by.

## Development

```sh
pnpm dev          # API on :3000, app on :5174, backoffice on :5173
pnpm app:dev      # just the app's dev server (needs the API running)
```

The dev server proxies `/api` to the API, so the session cookie is
first-party in development too. `APP_PORT` comes from
[app/server/env.ts](../app/server/env.ts) — the app owns its own environment
schema, like the backoffice does.

Better Auth checks the `Origin` of every credential POST, so `TRUSTED_ORIGINS`
in `.env` must include `http://localhost:5174` (the default in `.env.example`
does). In production the app is served from the API's own origin, which is
trusted by default.

## Production

`pnpm build` emits the app to `dist/app`, and the API process serves it:
[app/server/web.ts](../app/server/web.ts) wraps the API in a static shell so
both live on one origin (no CORS, first-party cookie). The API answers first;
only a 404 on a path the API does not own falls through to `index.html`,
because that path belongs to the client router. Unknown `/api/*` paths keep
the JSON error envelope.

Mounting happens in the composition root
([domain-server/server.ts](../domain-server/server.ts)) — the API itself knows
nothing about the app.

## Testing

Router and guard functions are unit-tested; everything else is a **user story
in Node against the real server**, through the same world kit as the client
([docs/client/testing.md](client/testing.md)):

```ts
const { core } = visit(world, "/sign-up");
await signUp(core, { name: "Ada", email: world.uniqueEmail("ada"), password });
expect(core.getState().route).toEqual({ kind: "dashboard" });
```

`visit()` ([app/tests/harness.ts](../app/tests/harness.ts)) is one browser: its
own cookie jar and history, `reload()` for the fresh core a page load builds.
