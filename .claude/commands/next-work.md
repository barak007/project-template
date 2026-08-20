---
description: Execute the next task from docs/next-work.md (one commit-sized slice per run)
---

You are executing the improvement plan in `docs/next-work.md`. You have zero prior context — everything you need is in the repo. This prompt is run repeatedly; each run advances the plan by exactly one step and records its progress so the next run (which also has zero context) can continue.

## Sources of truth

1. `docs/next-work.md` — the plan AND the progress state. Checkboxes are the state: `- [ ]` not done, `- [x]` done. The **Work log** section at the bottom records what each run did.
2. `AGENTS.md` — the rules. Read it in full before touching code. Non-negotiables for this work: all client logic is headless (state + events + pure projection, actions; UI owns no logic and no `useState` the core could hold), client logic is tested in Node through the world kit (never mock the API, `it.concurrent`, no fixed identifiers), docs/client wiki updates ship in the same change as client-surface changes, coverage thresholds are floors — never lower them.
3. The reference implementation for every headless pattern is `app/client/` (state slices, `attempt`, pending/confirming keys) — mirror it, don't reinvent.

## Protocol — follow in order

### 0. Recover

Run `git status`. If the working tree is dirty, a previous run was interrupted. Inspect the changes, finish or fix them into a coherent state that passes step 4, book-keep and commit them per steps 5–6 as their own step, and STOP. Only start new work from a clean tree.

### 1. Pick

Open `docs/next-work.md`. Pick the **first unchecked checkbox, top to bottom** (Milestone 1 before 2 before 3 before 4). Skip the "Decisions needed" section — those are Barak's calls, not tasks. If every checkbox is checked, say so and stop.

### 2. Scope

One run = one coherent change that lands green. If the picked task is too large for that (e.g. the table-page extraction), do NOT attempt it whole: split it in `docs/next-work.md` into indented sub-checkboxes — concrete, ordered, each independently landable with the build green (an extraction sub-step must include rewiring its UI call sites, not leave two copies) — then execute only the first sub-item. The parent checkbox gets checked only when all its children are.

### 3. Execute

Do the work. Requirements that override any shortcut:

- Logic extracted from UI goes into the matching `client/` dir as state slices + events + actions; the component becomes a thin adapter (reads store, dispatches actions). Delete the old in-component version in the same change — no dual implementations.
- Every extraction lands WITH Node story tests through the world kit (`domain-client/tests/kit`, `app/tests/harness.ts`, or the backoffice equivalent). Untested extraction = incomplete task.
- Client-surface changes (action, event, state slice, host capability) update the matching `docs/client/` page in the same change.
- New environment variables go through the env schemas; never read `process.env` elsewhere.
- This is a template with no legacy to maintain: prefer the clean design over compatibility with the code you're replacing.

### 4. Verify

`pnpm check` must pass completely (format, lint, typecheck, coverage, build). Do not weaken any config to get green — no threshold lowering, no eslint-disable, no test deletion. If genuinely blocked (e.g. the task turns out to depend on an unmade decision), revert to a clean tree, and instead record the blocker: add a note under the task in `docs/next-work.md` explaining what blocks it and mark it `- [blocked]` so future runs skip it; that note-commit is your run's output.

### 5. Book-keep (this is what lets the next run progress)

In `docs/next-work.md`:

- Check off the completed (sub-)item: `- [x]`.
- Append one line to the **Work log** section: `- YYYY-MM-DD <what was done, files touched, anything the next run must know>`.
- If your refactor moved code that other unchecked tasks reference by file:line, update those references so the next run isn't chasing stale line numbers.

### 6. Commit

Commit the code AND the `docs/next-work.md` update together in one commit with a descriptive message. The doc must never describe a state other than HEAD.

### 7. Stop

One (sub-)task per run. Do not start the next item. End by stating what was completed, what the next run will pick up, and the overall progress (checked/total).
