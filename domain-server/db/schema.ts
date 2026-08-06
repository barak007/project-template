import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

// Better Auth core schema. Property names intentionally match its adapter contract.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ...timestamps,
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
export const sourceKind = pgEnum("source_kind", ["git", "database", "other"]);
export const workSessionStatus = pgEnum("work_session_status", [
  "pending",
  "materializing",
  "ready",
  "failed",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_members_user_idx").on(table.userId),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: sourceKind("kind").notNull(),
    config: jsonb("config").$type<JsonValue>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sources_org_name_unique").on(table.organizationId, table.name),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workspaces_org_name_unique").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const workspaceSources = pgTable(
  "workspace_sources",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.sourceId] })],
);

export const organizationSecrets = pgTable(
  "organization_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_secrets_scope_key_unique").on(
      table.organizationId,
      table.key,
    ),
  ],
);

export const userSecrets = pgTable(
  "user_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_secrets_scope_key_unique").on(table.userId, table.key),
  ],
);

export const organizationData = pgTable(
  "organization_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<JsonValue>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_data_scope_key_unique").on(
      table.organizationId,
      table.key,
    ),
  ],
);

export const userData = pgTable(
  "user_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<JsonValue>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_data_scope_key_unique").on(table.userId, table.key),
  ],
);

export type SourceSnapshot = {
  id: string;
  name: string;
  kind: "git" | "database" | "other";
  config: JsonValue;
};

export const workSessions = pgTable(
  "work_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: workSessionStatus("status").default("pending").notNull(),
    sourcesSnapshot: jsonb("sources_snapshot")
      .$type<SourceSnapshot[]>()
      .notNull(),
    secretsSnapshot: jsonb("secrets_snapshot")
      .$type<Record<string, string>>()
      .notNull(),
    dataSnapshot: jsonb("data_snapshot")
      .$type<Record<string, JsonValue>>()
      .notNull(),
    failureCode: text("failure_code"),
    ...timestamps,
  },
  (table) => [
    index("work_sessions_organization_idx").on(table.organizationId),
    index("work_sessions_workspace_idx").on(table.workspaceId),
    index("work_sessions_creator_idx").on(table.createdByUserId),
    index("work_sessions_pending_idx")
      .on(table.status)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const schema = {
  account,
  organizationData,
  organizationMembers,
  organizationSecrets,
  organizations,
  session,
  sources,
  user,
  userData,
  userSecrets,
  verification,
  workspaceSources,
  workspaces,
  workSessions,
};

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
