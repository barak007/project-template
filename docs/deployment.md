# Deployment and rollback

## Initial Render deployment

1. Connect this repository as a Render Blueprint using `render.yaml`.
2. Confirm the Blueprint creates one API service, one worker, one PostgreSQL database, and the shared environment group. Do not set an explicit branch; Render uses the repository default branch and each PR revision for previews.
3. Set `SENTRY_DSN` on the production API and worker if Sentry error reporting is required. It is declared `sync: false`, is never stored in Git, and is intentionally absent from previews.
4. Protect the Render production environment for administrators. Enable notifications for failed deploys and unhealthy services. Render centralizes stdout/stderr logs and polls `/health`; Sentry receives unexpected application errors when configured.
5. In GitHub branch protection, require the `CI / check` status on the default branch, require pull requests, and prevent bypass except for designated administrators. Render's `checksPass` trigger then deploys the default branch only after CI succeeds.

The Docker pre-deploy command runs `node dist/migrate.js` before the API revision starts. A non-zero migration exit blocks the revision. The API and worker use the same Dockerfile and Git revision. PostgreSQL credentials, auth secrets, and the 32-byte encryption key are injected by Render and are not build arguments or image layers.

## Pull request previews

Render automatically creates the entire Blueprint for PRs, including an isolated empty PostgreSQL database, API, worker, generated auth/encryption secrets, and a preview-specific `RENDER_EXTERNAL_URL`. The initial deploy hook loads only deterministic, non-sensitive seed data. `/health` must pass before Render marks the preview healthy, and the Render GitHub integration posts the environment link and status on the PR.

Restrict automatic previews to trusted repository branches in the Render GitHub App settings. Fork workflows receive no deployment secrets; `SENTRY_DSN` and any future email, billing, or webhook credentials use `sync: false`, so preview environments cannot perform those side effects. Render updates a preview for later commits and deletes it when the PR closes; inactive previews also expire after three days.

## Rollback

1. In Render, select the last known-good API deploy and choose **Rollback**. Roll back the worker to the exact same commit before resuming job processing.
2. Do not reverse a database migration automatically. Prefer a forward-compatible corrective migration from the restored application revision. If a truly destructive migration requires database restoration, stop the API and worker and restore the Render PostgreSQL backup to a new database before changing `DATABASE_URL`.
3. Verify `/health` and `/ready`, sign in, read an organization, and enqueue a test work session. Confirm the worker changes it from `pending` to `ready`.
4. Review Render logs, pg-boss dead-letter queue `work-session.materialize.dead-letter`, and Sentry before declaring recovery complete.

Both processes handle `SIGTERM`, stop accepting new work, drain their server/worker, close queue and database connections, and use a 25-second application timeout inside Render's 30-second shutdown window.

## Operational alerts

At minimum, configure notifications for failed Blueprint/deploy events, API health-check failures, elevated 5xx responses, PostgreSQL storage/connection pressure, worker restarts, and jobs entering the dead-letter queue. Route unexpected exceptions through Sentry and keep request bodies, cookies, database URLs, and secret snapshot values out of logs and error metadata.
