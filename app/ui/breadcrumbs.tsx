import {
  currentOrganization,
  currentWorkSession,
  currentWorkspace,
} from "../client/index.js";
import type { AppCore, Route } from "../client/index.js";

import { EntityIcon } from "./entity-icon.js";
import type { Entity } from "./entity-icon.js";
import { RouteLink } from "./route-link.js";
import { useAppState } from "./use-app-state.js";

/** `key` is the level, not the label: two levels can legitimately read alike. */
type Crumb = { key: string; entity: Entity; label: string; to: Route };

/**
 * Where the user is, as the whole path rather than one step back. The trail is
 * derived from the route, so no page has to be told what is above it — and every
 * ancestor is one click away instead of only the parent.
 *
 * Every crumb carries its entity icon, including the one for the page you are
 * on. Names repeat across levels — a new organization starts with a workspace
 * named after it — so "Acme / Acme" is only legible if the two say what kind of
 * thing they are.
 *
 * Names come from the collections the page loads, so a crumb reads as its entity
 * until the list holding its name arrives.
 */
export function Breadcrumbs({ core }: { core: AppCore }) {
  // Four stable slices, and the trail built during render: a selector that
  // returned the array would hand useSyncExternalStore a new value every call.
  const route = useAppState(core, (state) => state.route);
  const organization = useAppState(core, currentOrganization);
  const workspace = useAppState(core, currentWorkspace);
  const session = useAppState(core, currentWorkSession);

  const crumbs = trail(
    route,
    organization?.name,
    workspace?.name,
    session?.projectBranch ?? undefined,
  );
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumbs">
        {crumbs.map((crumb, index) =>
          index === crumbs.length - 1 ? (
            // The page you are on is a position, not somewhere to go.
            <li key={crumb.key} aria-current="page">
              <span className="entity-chip">
                <EntityIcon entity={crumb.entity} />
                {crumb.label}
              </span>
            </li>
          ) : (
            <li key={crumb.key}>
              <RouteLink core={core} to={crumb.to} className="entity-chip">
                <EntityIcon entity={crumb.entity} />
                {crumb.label}
              </RouteLink>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}

function trail(
  route: Route,
  organizationName: string | undefined,
  workspaceName: string | undefined,
  sessionName: string | undefined,
): Crumb[] {
  if (
    route.kind !== "organization" &&
    route.kind !== "workspace" &&
    route.kind !== "workspace-project" &&
    route.kind !== "session"
  )
    return [];

  const { organizationId } = route;
  const crumbs: Crumb[] = [
    {
      key: "organizations",
      entity: "organization",
      label: "Organizations",
      to: { kind: "dashboard" },
    },
    {
      key: "organization",
      entity: "organization",
      label: organizationName ?? "Organization",
      to: { kind: "organization", organizationId },
    },
  ];
  if (route.kind === "organization") return crumbs;

  const { workspaceId } = route;
  crumbs.push({
    key: "workspace",
    entity: "workspace",
    label: workspaceName ?? "Workspace",
    to: { kind: "workspace", organizationId, workspaceId },
  });
  if (route.kind === "workspace") return crumbs;

  crumbs.push(
    route.kind === "workspace-project"
      ? {
          key: "project",
          entity: "project",
          // The workspace above already names it; this crumb says which of its
          // two things — the shared project, not one session's copy.
          label: "Project",
          to: { kind: "workspace-project", organizationId, workspaceId },
        }
      : {
          key: "session",
          entity: "session",
          // A session's name is the branch it works on, as on its own page.
          label: sessionName ?? "Session",
          to: {
            kind: "session",
            organizationId,
            workspaceId,
            workSessionId: route.workSessionId,
          },
        },
  );
  return crumbs;
}
