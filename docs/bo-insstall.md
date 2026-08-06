# Task handoff: Backoffice installer / setup wizard

Repo: `/Users/barakigal/projects/what-we-sure-about` (branch `main`). This doc is
self-contained — a fresh agent with no prior context should be able to execute
from it directly.

## Goal

Add a WordPress-style "installer" page to the existing `backoffice/` React
app: it's the **first screen shown when the app isn't configured yet**, and
becomes an ordinary settings panel in the backoffice nav once setup is
complete. Two capabilities:

1. Show `.env` configuration status, and let a local developer fix it from
   the browser (writes to the local `.env` file).
2. Manage login providers, starting with Google OAuth as the one concrete
   example (wired into `domain-server/auth.ts`'s `betterAuth()` call, which currently
   only has `emailAndPassword: { enabled: true }`).

## Why this shape (context from exploration)

- The repo is a Hono + Postgres/Drizzle + Better Auth + pg-boss boilerplate,
  meant to be forked by other developers, deployed to Render via
  `render.yaml` as a Blueprint.
- `backoffice/` already exists (uncommitted, in-progress work — do not
  discard it) as a separate Vite React app mirroring the headless
  `client` action/state pattern: `backoffice/core/` (actions + store,
  reusing `client/host.ts` / `store.ts` / `errors.ts` directly) and
  `backoffice/ui/` (React components). It currently has Sign-in →
  Users/Organizations admin console, gated by a `platformAdmins` DB table via
  `requirePlatformAdmin` (`domain-server/services/policy.ts`).
- `domain-server/config/env.ts`'s `loadEnvironment()` is a Zod schema that **throws**
  on invalid/missing env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET` min 32
  chars, `SECRETS_ENCRYPTION_KEY` must decode to exactly 32 bytes,
  `BETTER_AUTH_URL`/`RENDER_EXTERNAL_URL`). `domain-server/runtime.ts`'s
  `createRuntime()` calls this first — if it throws, `domain-server/server.ts` never
  starts an HTTP server at all. This is the chicken-and-egg problem: the
  installer needs _some_ running server to report/fix env issues, so
  degraded-boot support is required.
- Production/preview (Render) env vars are **entirely** managed by Render
  (`render.yaml` `envVarGroups`, `generateValue: true`, `fromDatabase`) —
  there is no `.env` file and no writable filesystem there. `.env` is
  local-dev-only (`.env.example` at repo root, loaded via `dotenv/config`).
- `backoffice/core/auth-actions.ts` has a deliberate comment: "Sign-in only:
  platform admins are granted (`pnpm admin:grant`), never self-served" — no
  self-serve admin-grant path exists today; `scripts/grant-platform-admin.ts`
  is a manual CLI script. The installer's "create first admin" step is a
  narrow, intentional exception to this — see decisions below.
- `betterAuth()` in `domain-server/auth.ts` builds its config **once** at process
  startup (inside `createRuntime()`). Any provider credentials configured
  later via the backoffice (DB-backed) only take effect after a process
  restart — there's no live-reload of the auth instance in this plan.
- `domain-server/db/schema.ts` has `organizationSecrets`/`userSecrets` tables using
  `domain-server/crypto/secrets.ts`'s `SecretCipher` for encryption-at-rest. OAuth
  client secrets should reuse that pattern, not sit in plaintext.
- Codebase convention (see repo memory / `AGENTS.md`): single-responsibility
  files, YAGNI — no generic "OAuth provider plugin system," just one
  concrete Google provider, following the exact pattern of existing
  `entities/` (Zod schemas) → `services/` (`(db, ...)` functions throwing
  `AppError`) → `routes/` (Hono + `zValidator`) layering used by
  `entities/admin.ts` / `services/admin.ts` / `routes/admin.ts`.

## Decisions to proceed with (recommended defaults — user was asked to

confirm via AskUserQuestion but the tool call errored out before an answer
landed; these are the "Recommended" options from that unanswered question,
consistent with auto-mode's bias toward proceeding rather than blocking):

1. **First-admin self-serve is dev-only.** The web-based "create the first
   admin" form only works when `NODE_ENV === "development"` (in addition to
   requiring the `platformAdmins` table to be empty). Production/Render
   deployments keep using `pnpm admin:grant <email>` via shell, unchanged —
   this avoids adding any new unauthenticated write path to a running
   production system. **If the user pushes back and wants this to also work
   on a genuinely empty production DB, drop the `NODE_ENV` check and rely on
   the empty-table check alone.**
2. **Restart UX is a manual message, not automatic.** After saving `.env` or
   provider settings, show a banner: "Saved — restart the server to apply."
   No file-watcher/auto-restart mechanism.
3. **Static-serving of `backoffice/dist` on a deployed server is out of
   scope.** Nothing serves backoffice's built assets today for
   Users/Organizations either — this is a pre-existing gap in the whole
   backoffice feature, not something to fix as part of this task. The
   installer is reached the same way: `pnpm backoffice:dev` (Vite dev server
   on :5173, proxying `/api/*` to :3000 in dev).
4. **DB-backed Google OAuth settings win over env vars when both present.**
   `resolveGoogleProvider()` checks the DB `platform_settings` row first
   (`enabled && value` present); falls back to `GOOGLE_CLIENT_ID`/
   `GOOGLE_CLIENT_SECRET` env vars if the DB row is absent/disabled.
5. **Only these `.env` keys get first-class installer read/write treatment:**
   `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `SECRETS_ENCRYPTION_KEY`. Everything else (`PORT`, `TRUSTED_ORIGINS`,
   `LOG_LEVEL`, `SENTRY_DSN`, `SHUTDOWN_TIMEOUT_MS`, `NODE_ENV`) has safe
   defaults and is out of scope — reporting them would be YAGNI noise.

If the user is available before/during implementation, quickly confirm these
five points — they were the open items from the plan review. Otherwise
proceed with them as stated.

## Concrete implementation plan

### 1. `domain-server/config/env.ts` (modify)

Add a non-throwing variant; keep `loadEnvironment()` behavior identical so no
existing caller (`domain-server/runtime.ts`, all of `scripts/*.ts`) needs to change:

```ts
export type EnvFieldStatus = {
  key: string;
  status: "ok" | "missing" | "invalid";
  message?: string;
};
export type SafeEnvironment =
  | { success: true; data: Environment }
  | { success: false; fields: EnvFieldStatus[] };

const REPORTED_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "SECRETS_ENCRYPTION_KEY",
] as const;

export function safeLoadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): SafeEnvironment {
  const result = environmentSchema.safeParse(source);
  if (result.success) return { success: true, data: result.data };
  const issuesByPath = new Map(
    result.error.issues.map((i) => [i.path.join("."), i.message]),
  );
  const fields = REPORTED_KEYS.map((key) => {
    const message =
      issuesByPath.get(key) ?? issuesByPath.get("BETTER_AUTH_URL");
    if (message === undefined) return { key, status: "ok" as const };
    return {
      key,
      status: source[key] ? ("invalid" as const) : ("missing" as const),
      message,
    };
  });
  return { success: false, fields };
}

export function loadEnvironment(source = process.env): Environment {
  const result = safeLoadEnvironment(source);
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${result.fields.map((f) => f.key).join(", ")}`,
    );
  return result.data;
}
```

Also add two new optional keys (env-fallback for Google OAuth):

```ts
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
```

### 2. `domain-server/db/schema.ts` (modify)

Add a table, reusing the encrypted-value pattern from `organizationSecrets`:

```ts
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(), // e.g. "auth.google"
  enabled: boolean("enabled").default(false).notNull(),
  encryptedValue: text("encrypted_value"), // JSON blob, null until configured
  ...timestamps,
});
```

Add `platformSettings` to the `schema` export object. Run `pnpm db:generate`
afterward to produce the migration (don't hand-author the SQL).

### 3. `domain-server/services/platform-settings.ts` (new)

```ts
export async function getPlatformSetting(db, cipher, key: string) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (!row?.encryptedValue)
    return { enabled: row?.enabled ?? false, value: null };
  return {
    enabled: row.enabled,
    value: JSON.parse(cipher.decrypt(row.encryptedValue)),
  };
}

export async function putPlatformSetting(
  db,
  cipher,
  userId,
  key,
  input: { enabled: boolean; value: unknown },
) {
  await requirePlatformAdmin(db, userId);
  const encryptedValue = input.value
    ? cipher.encrypt(JSON.stringify(input.value))
    : null;
  await db
    .insert(platformSettings)
    .values({ key, enabled: input.enabled, encryptedValue })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { enabled: input.enabled, encryptedValue, updatedAt: new Date() },
    });
}
```

### 4. `domain-server/entities/setup.ts` (new)

Zod schemas, following `entities/admin.ts` conventions:

```ts
export const envFieldStatusSchema = z.object({
  key: z.string(),
  status: z.enum(["ok", "missing", "invalid"]),
  message: z.string().optional(),
});
export const providerStatusSchema = z.object({
  configured: z.boolean(),
  enabled: z.boolean(),
  source: z.enum(["env", "database", "none"]),
});
export const setupStatusResponseSchema = z.object({
  env: z.object({
    valid: z.boolean(),
    writable: z.boolean(),
    fields: z.array(envFieldStatusSchema),
  }),
  database: z.object({ reachable: z.boolean() }),
  admin: z.object({ exists: z.boolean(), canSelfServe: z.boolean() }),
  providers: z.object({ google: providerStatusSchema }),
  complete: z.boolean(),
});
export const envWriteInputSchema = z.object({
  values: z.record(z.string(), z.string()),
});
export const firstAdminInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export const googleProviderInputSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});
```

### 5. `domain-server/config/env-file.ts` (new)

Tiny `.env` reader/writer (no library needed — `dotenv` only parses, doesn't
serialize):

```ts
const ENV_PATH = path.resolve(process.cwd(), ".env");

export function isEnvWritable(): boolean {
  if (process.env.NODE_ENV === "production" || process.env.RENDER !== undefined)
    return false;
  try {
    fs.accessSync(path.dirname(ENV_PATH), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function writeEnvFile(updates: Record<string, string>): void {
  const existing = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8").split("\n")
    : [];
  const keys = new Set(Object.keys(updates));
  const kept = existing.filter((line) => {
    const [key] = line.split("=");
    return !(key && keys.has(key.trim()));
  });
  const appended = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, [...kept, ...appended].join("\n") + "\n");
}
```

### 6. `domain-server/auth.ts` (modify)

`createAuth` gains a third param, already-resolved by the caller (keeps
`createAuth` itself sync/simple):

```ts
export function createAuth(
  db,
  environment,
  socialProviders?: Parameters<typeof betterAuth>[0]["socialProviders"],
) {
  return betterAuth({
    // ...existing config...
    emailAndPassword: { enabled: true },
    socialProviders,
    // ...
  });
}
```

### 7. `domain-server/runtime.ts` (modify) — degraded boot + provider resolution

```ts
async function resolveGoogleProvider(db, cipher, environment) {
  const setting = await getPlatformSetting(db, cipher, "auth.google");
  if (setting.enabled && setting.value)
    return { source: "database" as const, config: setting.value };
  if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET)
    return {
      source: "env" as const,
      config: {
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
      },
    };
  return { source: "none" as const, config: null };
}

export type RuntimeResult =
  | { kind: "degraded"; envFields: EnvFieldStatus[] }
  | {
      kind: "ready";
      environment: Environment;
      client;
      queue: QueueRuntime;
      dependencies: RuntimeDependencies;
    };

export async function createRuntime(): Promise<RuntimeResult> {
  const parsed = safeLoadEnvironment();
  if (!parsed.success) return { kind: "degraded", envFields: parsed.fields };
  const environment = parsed.data;
  const { db, client } = createDatabase(environment);
  const queue = new QueueRuntime(environment.DATABASE_URL);
  const reportError = configureObservability(environment);
  await queue.start();
  const cipher = new SecretCipher(environment.SECRETS_ENCRYPTION_KEY);
  const google = await resolveGoogleProvider(db, cipher, environment);
  return {
    kind: "ready",
    environment,
    client,
    queue,
    dependencies: {
      db,
      environment,
      cipher,
      jobs: queue,
      reportError,
      auth: createAuth(
        db,
        environment,
        google.config ? { google: google.config } : undefined,
      ),
      ready: async () => {
        await db.execute(sql`select 1`);
      },
    },
  };
}
```

### 8. `domain-server/http/context.ts` (modify)

Add `environment: Environment` to `RuntimeDependencies`. Mechanical, additive
— update the two fake-dependencies factories used in tests (see step 14).

### 9. `domain-server/server.ts` (modify) — branch on `runtime.kind`

```ts
const runtime = await createRuntime();
if (runtime.kind === "degraded") {
  const app = createDegradedApp(runtime.envFields);
  serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3000 }, (info) =>
    console.info(
      `API in setup mode at http://localhost:${info.port} — visit the backoffice to finish configuration`,
    ),
  );
  // no db/queue to shut down; SIGINT/SIGTERM just exit.
} else {
  const app: AppType = createApp(runtime.dependencies);
  // ...unchanged serve() + shutdown() logic exactly as today, using runtime.environment/runtime.queue/runtime.client
}
```

### 10. `domain-server/worker.ts` (modify minimally)

No UI story for the worker — degraded mode there behaves like the old
throwing behavior:

```ts
const runtime = await createRuntime();
if (runtime.kind === "degraded") {
  console.error("Invalid environment configuration:", runtime.envFields);
  process.exit(1);
}
await runtime.queue.registerWorkers(runtime.dependencies.db);
```

### 11. `domain-server/setup-app.ts` (new) — degraded-mode Hono app

```ts
export function createDegradedApp(envFields: EnvFieldStatus[]) {
  const app = new Hono()
    .get("/health", (c) => c.json({ status: "ok" as const }))
    .get("/ready", (c) =>
      c.json(
        {
          error: {
            code: "NOT_READY",
            message: "Environment is not configured",
          },
        },
        503,
      ),
    )
    .route(
      "/api/setup",
      createSetupPublicRoutes({ kind: "degraded", envFields }),
    );
  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404),
  );
  return app;
}
```

### 12. `domain-server/routes/setup.ts` (new)

Two exports, mirroring `routes/admin.ts`'s composition style:

```ts
// Unauthenticated by design — self-gates via emptiness/env checks. Mounted
// in both degraded and ready mode.
export function createSetupPublicRoutes(runtime: RuntimeResult) {
  const routes = new Hono();
  routes.get("/status", async (c) =>
    c.json(setupStatusResponseSchema.parse(await getSetupStatus(runtime)), 200),
  );
  routes.post(
    "/env",
    zValidator("json", envWriteInputSchema, validationHook),
    async (c) => {
      if (!isEnvWritable())
        throw new AppError(
          "FORBIDDEN",
          "Environment is managed by your host and cannot be edited here",
          403,
        );
      writeEnvFile(c.req.valid("json").values);
      Object.assign(process.env, c.req.valid("json").values); // immediate re-validation feedback only
      return c.json({ written: true, requiresRestart: true }, 200);
    },
  );
  routes.post(
    "/first-admin",
    zValidator("json", firstAdminInputSchema, validationHook),
    async (c) => {
      if (runtime.kind !== "ready")
        throw new AppError(
          "VALIDATION_FAILED",
          "Environment is not configured yet",
          400,
        );
      if (runtime.environment.NODE_ENV !== "development")
        throw new AppError(
          "FORBIDDEN",
          "Use `pnpm admin:grant <email>` in this environment",
          403,
        );
      const result = await createFirstAdmin(
        runtime.dependencies.db,
        runtime.dependencies.auth,
        c.req.valid("json"),
      );
      return c.json(result, 201);
    },
  );
  return routes;
}

// Requires an existing platform admin session; only mounted when ready.
export function createSetupAdminRoutes(dependencies: RuntimeDependencies) {
  const routes = new Hono<AppBindings>();
  routes.use("*", requireAuthentication(dependencies));
  routes.put(
    "/google",
    zValidator("json", googleProviderInputSchema, validationHook),
    async (c) => {
      await putPlatformSetting(
        dependencies.db,
        dependencies.cipher,
        c.get("user").id,
        "auth.google",
        {
          enabled: c.req.valid("json").enabled,
          value: {
            clientId: c.req.valid("json").clientId,
            clientSecret: c.req.valid("json").clientSecret,
          },
        },
      );
      return c.json({ saved: true, requiresRestart: true }, 200);
    },
  );
  return routes;
}
```

### 13. `domain-server/services/setup.ts` (new)

```ts
export async function getSetupStatus(runtime: RuntimeResult) {
  if (runtime.kind === "degraded") {
    return {
      env: {
        valid: false,
        writable: isEnvWritable(),
        fields: runtime.envFields,
      },
      database: { reachable: false },
      admin: { exists: false, canSelfServe: false },
      providers: {
        google: { configured: false, enabled: false, source: "none" },
      },
      complete: false,
    };
  }
  const { db, cipher, environment } = runtime.dependencies;
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(platformAdmins);
  const google = await resolveGoogleProvider(db, cipher, environment);
  const adminExists = count > 0;
  return {
    env: { valid: true, writable: isEnvWritable(), fields: [] },
    database: { reachable: true }, // reaching this point means db.select already succeeded
    admin: {
      exists: adminExists,
      canSelfServe: !adminExists && environment.NODE_ENV === "development",
    },
    providers: {
      google: {
        configured: google.source !== "none",
        enabled: google.source !== "none",
        source: google.source,
      },
    },
    complete: adminExists,
  };
}

export async function createFirstAdmin(
  db,
  auth,
  input: { name; email; password },
) {
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(platformAdmins);
  if (count > 0)
    throw new AppError(
      "FORBIDDEN",
      "An admin already exists; use pnpm admin:grant",
      403,
    );
  const { user } = await auth.api.signUpEmail({ body: input }); // reuses better-auth's own hashing/validation
  await db.transaction(async (tx) => {
    const [{ count: recheck }] = await tx
      .select({ count: sql`count(*)` })
      .from(platformAdmins);
    if (recheck > 0)
      throw new AppError(
        "FORBIDDEN",
        "An admin already exists; use pnpm admin:grant",
        403,
      );
    await tx
      .insert(platformAdmins)
      .values({ userId: user.id })
      .onConflictDoNothing();
  });
  return { userId: user.id, email: user.email };
}
```

### 14. `domain-server/app.ts` (modify)

Mount the setup routes. `createApp` currently only receives
`RuntimeDependencies` (not the full `RuntimeResult`), so build a `{ kind:
"ready", ... }` value from `dependencies` inline before calling
`createSetupPublicRoutes`, keeping `createApp`'s own signature unchanged —
zero ripple beyond the one new `environment` field added to
`RuntimeDependencies` in step 8:

```ts
.route("/api/setup", createSetupPublicRoutes({ kind: "ready", environment: dependencies.environment, dependencies, client: null, queue: null }))
.route("/api/setup/providers", createSetupAdminRoutes(dependencies))
```

(Adjust the inline literal so its shape actually satisfies `RuntimeResult`'s
`"ready"` variant — `client`/`queue` aren't used by `getSetupStatus`, so
either drop them from the type that `getSetupStatus` actually consumes, or
pass real values through. Prefer narrowing `getSetupStatus`'s parameter type
to just `{ dependencies } | { envFields }` rather than forcing the full
`RuntimeResult` shape into `app.ts` — avoids a fake `client`/`queue`.)

### 15. Update test fakes (mechanical)

`RuntimeDependencies` gained `environment`. Add a minimal fake `Environment`
object to:

- `domain-server/tests/helpers/harness.ts` (`createTestApp`'s dependencies object)
- `domain-server/tests/api.test.ts` (`dependencies()` factory)
- Any `backoffice/tests/*.ts` fake dependencies, if present

### 16. Backoffice core: setup action namespace

**`backoffice/core/setup-actions.ts`** (new), same shape as
`admin-actions.ts`:

```ts
export function createSetupActions(api: Api, store: BackofficeStore) {
  return {
    loadStatus: async () => {
      const response = await api.api.setup.status.$get();
      if (!response.ok) throw await toApiError(response);
      store.dispatch({
        type: "setup-status-loaded",
        status: await response.json(),
      });
    },
    writeEnv: async (values: Record<string, string>) => {
      const response = await api.api.setup.env.$post({ json: { values } });
      if (!response.ok) throw await toApiError(response);
    },
    createFirstAdmin: async (input: {
      name: string;
      email: string;
      password: string;
    }) => {
      const response = await api.api.setup["first-admin"].$post({
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
      store.dispatch({ type: "first-admin-created" });
    },
    saveGoogleProvider: async (input: {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
    }) => {
      const response = await api.api.setup.providers.google.$put({
        json: input,
      });
      if (!response.ok) throw await toApiError(response);
    },
  };
}
```

Note: `createFirstAdmin` does **not** sign the browser in — `signUpEmail` is
called server-side in-process, no `Set-Cookie` reaches the browser. After
success, show "Admin created — sign in below" and fall through to the
existing `<SignIn>` component unchanged.

Also modify:

- `backoffice/core/api.ts` — add `export type SetupStatus = InferResponseType<Api["api"]["setup"]["status"]["$get"]>;`
- `backoffice/core/state.ts` — add `setup: SetupStatus | null` and `firstAdminCreated: boolean` to `BackofficeState`.
- `backoffice/core/events.ts` — add `{ type: "setup-status-loaded"; status: SetupStatus }` and `{ type: "first-admin-created" }`.
- `backoffice/core/projection.ts` — handle the two new event cases.
- `backoffice/core/index.ts` — add `setup: createSetupActions(api, store)` to the returned object.

### 17. Backoffice UI

**`backoffice/ui/app.tsx`** (modify) — load setup status on mount, before
the existing auth gate:

```tsx
export function App({ core }: { core: BackofficeCore }) {
  const auth = useBackofficeState(core, (s) => s.auth);
  const setup = useBackofficeState(core, (s) => s.setup);
  const [view, setView] = useState<View>({ kind: "users" });
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    void core.setup.loadStatus();
  }, [core]);

  if (setup === null) return <LoadingScreen />;
  if (!setup.complete) return <SetupWizard core={core} status={setup} />;
  if (auth.status !== "authenticated") return <SignIn core={core} />;

  return (
    <div className="layout">
      <header>
        <strong>Backoffice</strong>
        <nav>
          <button
            className={view.kind === "users" ? "active" : ""}
            onClick={() => setView({ kind: "users" })}
          >
            Users
          </button>
          <button
            className={
              view.kind === "organizations" || view.kind === "organization"
                ? "active"
                : ""
            }
            onClick={() => setView({ kind: "organizations" })}
          >
            Organizations
          </button>
          <button
            className={view.kind === "setup" ? "active" : ""}
            onClick={() => setView({ kind: "setup" })}
          >
            Setup
          </button>
        </nav>
        <span className="spacer" />
        <span>{auth.user.email}</span>
        <button onClick={() => void core.auth.signOut()}>Sign out</button>
      </header>
      <main>
        {forbidden ? (
          <section className="panel">...</section>
        ) : view.kind === "users" ? (
          <UsersPage core={core} load={load} />
        ) : view.kind === "organizations" ? (
          <OrganizationsPage
            core={core}
            load={load}
            onOpen={(organizationId) =>
              setView({ kind: "organization", organizationId })
            }
          />
        ) : view.kind === "setup" ? (
          <SetupWizard core={core} status={setup} ongoing />
        ) : (
          <OrganizationDetailPage
            core={core}
            load={load}
            organizationId={view.organizationId}
            onBack={() => setView({ kind: "organizations" })}
          />
        )}
      </main>
    </div>
  );
}
```

`View` gains `{ kind: "setup" }`.

**`backoffice/ui/setup-wizard.tsx`** (new) — one component handling both the
pre-auth first-run flow and the post-auth ongoing-settings-panel case. Three
sections:

- **Environment section**: table of `status.env.fields` (ok/missing/invalid
  - message). If `status.env.writable`: inline inputs + "Save to .env"
    button calling `core.setup.writeEnv`, with a persistent banner after save:
    "Saved — restart the dev server (Ctrl-C, then `pnpm dev`) to apply." If
    not writable: read-only text "These values are managed by your hosting
    provider and can't be edited here."
- **Admin section**: if `status.admin.exists`, show nothing (or "Admin
  configured"); else if `status.admin.canSelfServe`, render a
  name/email/password form calling `core.setup.createFirstAdmin`; else
  (prod, no admin) render "No platform admin yet. Run `pnpm admin:grant
<email>` from a shell with access to this deployment."
- **Providers section**: Google OAuth enabled toggle + client ID/secret
  inputs (masked), "Save" calling `core.setup.saveGoogleProvider`, same
  "restart required" banner. Show `status.providers.google.source` so the
  admin knows whether env vars or the DB row currently win.

## Files touched — summary

New:

- `domain-server/config/env-file.ts`
- `domain-server/entities/setup.ts`
- `domain-server/services/setup.ts`
- `domain-server/services/platform-settings.ts`
- `domain-server/routes/setup.ts`
- `domain-server/setup-app.ts`
- `backoffice/core/setup-actions.ts`
- `backoffice/ui/setup-wizard.tsx`
- new Drizzle migration for `platform_settings` (via `pnpm db:generate`)

Modified:

- `domain-server/config/env.ts` (add `safeLoadEnvironment`, `GOOGLE_CLIENT_ID`/`SECRET`)
- `domain-server/db/schema.ts` (add `platformSettings`)
- `domain-server/auth.ts` (accept `socialProviders` param)
- `domain-server/runtime.ts` (return `RuntimeResult` union, resolve Google provider)
- `domain-server/server.ts` / `domain-server/worker.ts` (branch on `runtime.kind`)
- `domain-server/http/context.ts` (`RuntimeDependencies` gains `environment`)
- `domain-server/app.ts` (mount `/api/setup`, `/api/setup/providers`)
- `backoffice/core/{api,state,events,projection,index}.ts`
- `backoffice/ui/app.tsx`
- `domain-server/tests/helpers/harness.ts`, `domain-server/tests/api.test.ts` (add `environment` field to fake dependencies)

## Verification

1. `pnpm db:generate` to produce the `platform_settings` migration; check the
   generated SQL looks sane before committing.
2. `pnpm typecheck` (runs `tsc --noEmit && tsc -p backoffice --noEmit`).
3. `pnpm lint`.
4. `pnpm test` — pay special attention to `domain-server/tests/admin-routes.test.ts` and
   `backoffice/tests/admin-console.test.ts` (existing suites whose fake
   dependencies need the new `environment` field) plus new tests for
   `getSetupStatus`/`createFirstAdmin`/env-file read-write.
5. Manual end-to-end check locally:
   - Temporarily rename/break `.env` (or point `DATABASE_URL` at nothing) and
     confirm `pnpm dev` still starts an HTTP server (degraded mode) and
     `curl localhost:3000/api/setup/status` reports the broken fields.
   - Restore `.env`, restart, confirm `pnpm backoffice:dev` shows the Setup
     wizard as the very first screen, lets you create the first admin (dev
     mode), then shows Sign-in, then shows Setup as a normal nav item after
     signing in.
   - Configure Google OAuth via the Setup panel, confirm it's stored
     encrypted in `platform_settings` (spot-check via `psql`, should not be
     plaintext), and confirm restarting the server picks it up as an
     available `socialProviders.google` config (a real end-to-end OAuth
     login isn't required for verification, just that the config wires
     through).
6. `pnpm check` (the full CI-equivalent gate: format, lint, typecheck, test
   coverage, build) before considering this done.

## Known open risk / don't silently "fix"

- `domain-server/app.ts`'s inline `RuntimeResult`-shaped literal (step 14) is
  slightly awkward because `createApp` only receives `RuntimeDependencies`,
  not the full `RuntimeResult`. Prefer narrowing whatever type
  `getSetupStatus` actually consumes down to just what it needs (`{
dependencies: RuntimeDependencies }` for the ready case, `{ envFields:
EnvFieldStatus[] }` for degraded) rather than forcing a fake
  `client`/`queue` into a `RuntimeResult`-shaped value just to satisfy a
  wider type. Resolve this cleanly rather than papering over it with `as any`
  or unused fields.
