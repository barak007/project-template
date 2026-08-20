# Next work

Status assessment and improvement plan, 2026-08-20. This repo is a template: every fix here is inherited by every project cloned from it, so fix the general pattern, not the call site (see [AGENTS.md](../AGENTS.md)).

There is no legacy to maintain.

**Execution protocol:** run the `/next-work` command (`.claude/commands/next-work.md`) in a fresh session. Each run picks the first unchecked box top-to-bottom, lands one commit-sized green slice, checks the box, and appends to the Work log at the bottom. This file's checkboxes ARE the progress state — it must always describe HEAD.

## Where the project stands

**Healthy.** `pnpm typecheck` is clean and all 320 tests across 51 files pass in Node with no external services (PGlite + real migrations). There is exactly one squashed migration (`drizzle/0000_init.sql`). Layering (routes → services → db, backoffice → src only, no globals in client code) is real and lint-enforced by 15 import zones — no violations found. `app/` is the model implementation of the headless client: zero `useState` in `app/ui/`, drafts/pending/errors all in the store, polished UI with design tokens, dark mode, and genuine accessibility work.

**The debt is concentrated in three places:**

1. **`backoffice/ui/` violates the headless approach systematically.** 13 `useState` hooks, and `backoffice/ui/table-page.tsx` (545 lines) _is_ the backoffice's real client core — query model, filters, sorting, debounce, editors, and error handling all live in React where Node tests can't reach them. Because coverage only includes `client/` and `server/` dirs, the coverage gate is structurally blind to all of it.
2. **Template-readiness.** 23 dependencies pinned to `latest`, no init/rename story (the project name is hardcoded in 10+ files), 6 broken doc links, dead scripts, and an unrelated scratch file (`IDEA.md`) in the tree.
3. **Backoffice UX.** Failed loads produce permanently blank screens (unhandled rejections), there are no loading states, deletes use `window.confirm`, and there is zero ARIA — in sharp contrast to the app.

The plan below is ordered so that Milestone 1 fixes the headless violations and the worst UX bugs _in one move_: the blank screens exist precisely because error handling lives in components instead of state.

---

## Milestone 1 — Make the backoffice headless (highest value)

The pattern to follow already exists in `app/client/`: state slices + events + a pure projection, an `attempt` funnel, `pending`/`confirming` keys. `backoffice/ui/users-page.tsx` already does it correctly via `state.userEditor` — apply that pattern everywhere.

- [x] **Extract the table query model out of `backoffice/ui/table-page.tsx` into `backoffice/client/`.** Move to state + events + actions, with Node story tests for each flow. Split into landable slices:
  - [x] Move the pure query logic — `buildFilters` and the route→query derivation (`tableQueryFromRoute`) — into `backoffice/client/table-view.ts` with Node unit tests; `table-page.tsx` imports them, local copies deleted.
  - [x] Move `query` + `drafts` into a table-view state slice: events for open-table reset, `toggleSort`, `clearFilters`, draft edits, filter apply (offset reset lives in the projection), and pagination; URL mirroring moved out of the UI effect into the view actions over `core.navigation.replace`. `table-page.tsx` keeps only a thin 300ms debounce effect that calls the apply action (a host timer capability is Milestone 2). Story tests per flow in `backoffice/tests/table-view-console.test.ts`.
  - [x] Move `editor` + `error` into the `tableView` slice: editor open/close events, and `view.mutate` runs row mutations with failures becoming `tableView.error` (`table-view-actions.ts`); navigation resets both, so the render-`key` remount workaround in `app.tsx` is gone. `table-page.tsx` has zero `useState`. Story tests.
- [ ] **Extract `row-editor.tsx` domain logic** — `parseDraft`, `initialDrafts`, dirty-field diffing (`row-editor.tsx:8-39, 54-56, 61-82`) into `backoffice/client/` with tests. This is type coercion + validation with zero coverage today.
- [ ] **Build a backoffice `attempt` equivalent** (mirror `app/client/attempt.ts`): errors become state, `AUTHENTICATION_REQUIRED` re-resolves auth, actions get pending keys. This removes the ad-hoc `load` callback in `backoffice/ui/app.tsx:22-36` and absorbs the `view.mutate` stopgap in `table-view-actions.ts` (auth handling still rides the UI's `load` at `table-page.tsx:102-103`), and **fixes all four P0 blank-screen bugs**: failed `loadStatus` → blank page (`main.tsx:31`), silent row-load failures (`table-page.tsx:77-80`), stuck `Loading…` on detail pages (`user-detail-page.tsx:22-24`, `organization-detail-page.tsx:20-22`), silently empty sidebar (`app.tsx:39-41`).
- [ ] **Move backoffice sign-in/setup drafts into the store** (`sign-in.tsx:9-10`, `setup.tsx:9-12`), including the password-confirmation rule — the app has held auth drafts in state from the start.
- [ ] **Replace `window.confirm`** (`table-page.tsx:108`) with the `confirming`-state pattern and a `ConfirmButton` like `app/ui/confirm-button.tsx`.
- [ ] **Add loading/empty state to the table** as state, not JSX guesswork: today a table switch renders an empty `<tbody>` with no feedback (`table-page.tsx:98, 350-356`).
- [ ] **Move pure helpers out of `.tsx`**: `formatCell`/`rowText`/`rowKey` (`table-page.tsx:12-34`; `rowText` is already imported by `users-page.tsx`) into `backoffice/client/`, where coverage sees them. Same for `referencesTo` consumption (`backoffice/client/selectors.ts` is 0% covered because its only caller is UI).
- [ ] **Rebalance backoffice tests toward stories**: today ~38 HTTP-route tests vs 16 headless story tests — inverted relative to `app/`. Each extraction above should land with story tests through the world kit.

## Milestone 2 — Headless gaps in the app

- [ ] **Add a `clock`/`timer` capability to `Host`** (`domain-client/host.ts`) and move the 1500ms polling loop out of React — it's duplicated in `app/ui/workspace-page.tsx:102-108` and `app/ui/session-page.tsx:39-45` only because ESLint (correctly) bans `setInterval` in client code. Then "polling stops when nothing is preparing" becomes testable in Node.
- [ ] **Write tests and the docs page for `workspaceAccess`** — the newest, most permission-sensitive client surface (`domain-client/workspace-access-actions.ts`, `app/client/workspace-access-actions.ts`, 301-line UI section) shipped in `74b335c` with zero tests and no `docs/client/` page, violating the wiki-in-same-change rule.
- [ ] **Move derivation logic into selectors/client**: invitation status partitioning (`app/ui/invitations-section.tsx:41-43, 201-206`, `inbox-section.tsx:20-27`), granted/candidates (`workspace-access-section.tsx:194-195`), `remoteOf` config unwrapping (`workspace-page.tsx:313-317`), `initials` (`app-shell.tsx:79-86`), `locationOf` (`app/ui/project-location.ts`).
- [ ] **Close the DOM-type loophole**: `app/tsconfig.json` and `backoffice/tsconfig.json` put `"DOM"` in `lib` while including `client/`, so client code compiles _with_ DOM types — the no-DOM guarantee currently rests on ESLint alone. Split the client dirs into their own tsconfig without the DOM lib.
- [ ] **Make the coverage gate actually gate, then raise the floors after Milestone 1.** Found 2026-08-20: `vitest run --coverage` prints threshold ERRORs (actuals: statements 89.87 < 93, branches 83.18 < 86, lines 92.11 < 94) but **exits 0**, so `pnpm check` passes anyway — the floors in `vitest.config.ts` enforce nothing today. Fix the gate (likely a vitest-`latest` regression; pinning is Milestone 3), set the floors to the then-current actuals, and ratchet up as the backoffice logic enters coverage. (`coverage/` is already gitignored and untracked — that part is done.)

## Milestone 3 — Template hardening (DX)

- [ ] **Pin dependencies.** 12/12 runtime and 11/14 dev deps are `"latest"`. One `pnpm add` months from now jumps every major at once. Pin to caret ranges from the current lockfile (`hono@^4.13.0`, `better-auth@^1.6.26`, `drizzle-orm@^0.45.2`, `pg-boss@^12.27.0`, `zod@^4.4.3`, …) and add a Renovate/Dependabot config. Align `typescript` (exact-pinned 6.0.3) with `typescript-eslint`.
- [ ] **Add an init story**: `scripts/init.ts` that rewrites the hardcoded project name — `package.json`, `domain-server/auth.ts:10`, `domain-server/jobs/queue.ts:25`, `domain-server/git/local-project-builder.ts:27-29`, `domain-server/config/env.ts:29` (`~/wwsa`), `render.yaml` (×6), `ci.yml`, `README.md` — plus a LICENSE and a "using this template" README section. (`app/index.html` already says "Acme", so naming is inconsistent even now.)
- [ ] **Fix stale docs**: 6 broken links (`README.md:51` → `src/db/schema.ts`; `docs/domain.md:5,22` → `src/...`; `AGENTS.md:34` and `docs/backoffice.md:60` → nonexistent `backoffice/core`), the dead `"backoffice/core"` entry in `tsconfig.json` `include`, and the factual error in AGENTS.md claiming the backoffice "composes `createClientCore` for all client-side operations (auth included)" — it deliberately doesn't (see `backoffice/client/index.ts:58-63`); the doc must match the decision. Also state in the README that the backoffice is a development/operations tool and is never deployed (see Resolved below), and remove its build from the production `pnpm build`.
- [ ] **Delete `IDEA.md`** (unrelated Podman scratch) and fix or remove `docs/bo-insstall.md` (typo'd filename, hardcoded absolute local path, describes the stale layout).
- [ ] **Single source of truth for config**: remove the inline `DATABASE_URL` default from `drizzle.config.ts:8-10` (import `loadEnvironment` instead); register `SMOKE_BASE_URL` and `POSTGRES_PORT` in a schema; add a `.refine` rejecting the literal `.env.example` `BETTER_AUTH_SECRET` placeholder (it's 41 chars, so it passes `min(32)` and boots with a public secret).
- [ ] **Wire or delete dead scripts**: CI inlines the exact logic of `scripts/check-migrations.ts` (`ci.yml:59-61`) — call `pnpm db:check` instead; wire `pnpm smoke` into deploy/preview or delete it.
- [ ] **Split `domain-server/routes/domain.ts`** (720 lines, 41 handlers) into a module per aggregate, matching the service-per-aggregate rule the repo already mandates.
- [ ] **Logger discipline**: route `domain-server/errors.ts:77`, `observability.ts:19`, `jobs/queue.ts:27` through the injected `Logger` (AGENTS rule 10) and stop double-logging 500s (`handleError` + `reportError` in `app.ts:38`).
- [ ] **Smoother first boot**: `pnpm dev` should preflight DB reachability and pending migrations instead of surfacing a runtime SQL error; consider collapsing the 4 manual setup steps into one `pnpm setup`.

## Milestone 4 — UX polish

- [ ] **Pending state on auth forms**: `app/client/session-actions.ts:44-63` calls `attempt` without a key, so sign-in/sign-up buttons never disable and double-submit is possible (`sign-in-page.tsx:51`, `sign-up-page.tsx:63`; same in backoffice `sign-in.tsx`, `setup.tsx`). Every other action does this correctly — add the keys.
- [ ] **Success feedback**: nothing confirms a successful create/invite/save anywhere. `createAppCore` already has `notices` — surface them as toasts and extend to the backoffice.
- [ ] **Real `<form>`s in the backoffice**: `row-editor.tsx:130` and `users-page.tsx:35` are `<div>`s — no Enter-to-submit, no Escape, no native validation, no autofocus. Mirror `app/ui/create-form.tsx`.
- [ ] **404 route** in both routers: unknown paths currently map silently to home (`app/client/router.ts:66-99`, `backoffice/client/router.ts:87-121`).
- [ ] **Members list shows raw UUIDs** (`app/ui/members-section.tsx:58-63`) — extend the members endpoint with name/email like grants already have (`workspace-access-section.tsx:131-132` proves the data exists).
- [ ] **Workbench loading/empty states** (`app/ui/workbench.tsx:38-53`): blank tree column while loading and for empty repos; replace the three bare `Loading…` strings (`workspace-project-page.tsx:58`, `session-page.tsx:56,78`) with the existing `Skeleton`.
- [ ] **Backoffice accessibility + theming**: zero ARIA today. Sortable headers are `<span onClick>` (`table-page.tsx:280-287`) — make them buttons with `aria-sort`; sidebar nav should be anchors with `aria-current`; label the per-column filter inputs; add focus management to the portalled popovers. Extract the duplicated design tokens (both `styles.css` files copy the same accent/shadows) into one shared token sheet, and give the backoffice the app's dark mode and a responsive breakpoint.
- [ ] **Deep-link polish** (low priority): unauthenticated visits to `/app/...` show sign-in while the URL still points at the protected page (`app/client/selectors.ts:17-27`) — the post-login restore is good; decide whether the intermediate URL state is acceptable and document it, or reflect the guard in the URL.

## Decisions needed (not tasks yet)

1. **Trim the domain?** Workspaces, work sessions, git materialization, secrets encryption, and the local git builder (~1,100 lines) are a _product_, not boilerplate. A cloner inherits all of it and must delete it. Consider a `template-minimal` branch or an init-script option that strips these aggregates.

## Resolved

- **Backoffice is a development/operations tool, not part of the deployed app** (decided 2026-08-20). It is never served in production — the Dockerfile not copying `backoffice/dist` is correct, not a gap. Follow-up (folded into Milestone 3 docs work): state this in the README, and drop `backoffice/dist` from `pnpm build` so the production build doesn't emit an artifact nothing serves.
- **Admin env-file write-back is fine as is.** `backoffice/server/env-file.ts` persists the one-time admin credential (email + password _hash_, never the password) into the local `.env` on first-run setup. The "immutable filesystem" concern only applied if the backoffice deployed to a server; as a local dev tool, a local file is the right store.

## Work log

One line per `/next-work` run, appended by the run itself: `- YYYY-MM-DD <what was done, files touched, anything the next run must know>`.

- 2026-08-20 Plan created; assessment based on commit `74b335c` (typecheck clean, 320/320 tests green). No code changed yet.
- 2026-08-20 Split the table-page extraction into 3 sub-slices and landed the first: `buildFilters` + `tableQueryFromRoute` moved to new `backoffice/client/table-view.ts` (exported via `backoffice/client/index.ts`), unit-tested in `backoffice/tests/table-view.test.ts` (10 tests, 330 total green); `table-page.tsx` rewired, local copies deleted. Also ran `prettier --write` — HEAD had pre-existing format violations in 8 unrelated files, so `pnpm format:check` was red before this run. Discovered the coverage thresholds don't fail the build (vitest exits 0 despite ERROR lines) — recorded on the Milestone 2 coverage task. Next run: sub-slice 2 (query+drafts state slice).
- 2026-08-20 Landed table-page sub-slice 2: `tableView` state slice (query, drafts, routeFilters) in `backoffice/client/state.ts`, reset by the `navigated` projection via `tableViewOnNavigate` (`table-view.ts`; same-table+filters navigations — the URL mirror looping back — keep the view, replacing the old skip-flag refs); 6 new events; `view` actions (`table-view-actions.ts`: setDraft/applyFilters/toggleSort/clearFilters/setLimit/nextPage/previousPage) own URL mirroring; `TableQuery`/`defaultTableQuery` moved data-actions→table-view (import-cycle avoidance); signed-in/signed-out rebuild the view from the kept route. `table-page.tsx` lost query/drafts `useState`+refs+3 effects (keeps: 300ms debounce → `applyFilters`, load-rows effect, editor/error until sub-slice 3); table pages remount via `tablePageKey` in `app.tsx`; route props dropped from TablePage/UsersPage/OrganizationsPage. 10 story tests in `table-view-console.test.ts` (340 total green); documented the slice in `docs/backoffice.md`. Next run: sub-slice 3 (editor+error into the slice, then drop the remount key).
- 2026-08-20 Landed table-page sub-slice 3, completing the M1.1 extraction: `tableView` gained `editor` (TableEditor: insert/edit-row) + `error`; 4 events (editor-opened/closed, mutation-started/failed); `view.openEditor`/`closeEditor`/`mutate` in `table-view-actions.ts` (mutate clears the previous error, catches → `tableView.error`, returns success so the UI closes the editor; auth funnel still rides the UI `load` until the attempt task). `table-page.tsx` now has zero `useState`; the `tablePageKey` remount workaround in `app.tsx` removed. 3 new stories (13 in the file, 343 total green); `docs/backoffice.md` updated. Next run: extract `row-editor.tsx` domain logic (M1.2).
