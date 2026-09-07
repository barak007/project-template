import { Hono } from "hono";

import { requireAuthentication } from "../http/auth-middleware.js";
import type { AppBindings, RuntimeDependencies } from "../http/context.js";

import { createInvitationRoutes } from "./invitations.js";
import { createOrganizationRoutes } from "./organizations.js";
import { createProjectFileRoutes } from "./project-files.js";
import { createRepositoryRoutes } from "./repositories.js";
import { createSourceRoutes } from "./sources.js";
import { createUserMessageRoutes } from "./user-messages.js";
import { createValueRoutes } from "./values.js";
import { createWorkSessionRoutes } from "./work-sessions.js";
import { createWorkspaceAccessRoutes } from "./workspace-access.js";
import { createWorkspaceRoutes } from "./workspaces.js";

export function createDomainRoutes(dependencies: RuntimeDependencies) {
  const routes = new Hono<AppBindings>();
  routes.use("*", requireAuthentication(dependencies));

  return routes
    .route("/", createOrganizationRoutes(dependencies))
    .route("/", createInvitationRoutes(dependencies))
    .route("/", createRepositoryRoutes(dependencies))
    .route("/", createSourceRoutes(dependencies))
    .route("/", createWorkspaceRoutes(dependencies))
    .route("/", createWorkspaceAccessRoutes(dependencies))
    .route("/", createProjectFileRoutes(dependencies))
    .route("/", createValueRoutes(dependencies))
    .route("/", createWorkSessionRoutes(dependencies))
    .route("/", createUserMessageRoutes(dependencies));
}

export type DomainRoutes = ReturnType<typeof createDomainRoutes>;
