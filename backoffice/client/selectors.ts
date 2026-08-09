import type { TableMeta } from "./api.js";
import { matchesFilter, parseFilterQuery } from "./filter-query.js";
import type { BackofficeState } from "./state.js";

export type IncomingReference = {
  table: string;
  column: string;
  onDelete?: string | undefined;
};

/**
 * Every foreign key across the schema that points at `tableName`, derived
 * from the loaded table metadata — the "referenced by" side of the graph.
 */
export function referencesTo(
  tables: TableMeta[],
  tableName: string,
): IncomingReference[] {
  return tables.flatMap((table) =>
    table.columns
      .filter((column) => column.references?.table === tableName)
      .map((column) => ({
        table: table.name,
        column: column.key,
        onDelete: column.references?.onDelete,
      })),
  );
}

/** Users matching the users-page filter (name or email, case-insensitive). */
export function visibleUsers(state: BackofficeState) {
  const filter = parseFilterQuery(state.usersPage.filter);
  if (!filter) return state.users;
  return state.users.filter((user) =>
    matchesFilter([user.name, user.email], filter),
  );
}

/** Organizations matching the organizations-page filter (name). */
export function visibleOrganizations(state: BackofficeState) {
  const filter = parseFilterQuery(state.organizationsPage.filter);
  if (!filter) return state.organizations;
  return state.organizations.filter((organization) =>
    matchesFilter([organization.name], filter),
  );
}
