import type { ReactNode } from "react";

import type { AppCore } from "../client/index.js";

import { Breadcrumbs } from "./breadcrumbs.js";
import { EntityIcon } from "./entity-icon.js";
import type { Entity } from "./entity-icon.js";

/**
 * The top of every page behind the login: where you are, what this is, and the
 * one action the page is for. The action has a slot here rather than a place in
 * the flow of the content, so it is in the same corner on every page instead of
 * wherever the sections happened to end.
 */
export function PageHeader({
  core,
  entity,
  title,
  lead,
  action,
}: {
  core: AppCore;
  entity: Entity;
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <Breadcrumbs core={core} />
      <div className="page-title">
        <div>
          <h1 className="entity-chip">
            <EntityIcon entity={entity} />
            {title}
          </h1>
          {lead === undefined ? null : <p>{lead}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
