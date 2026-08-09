import type { TableMeta } from "./api.js";
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
  const query = state.usersPage.filter.trim().toLowerCase();
  if (!query) return state.users;
  return state.users.filter(
    (user) =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query),
  );
}

/** Organizations matching the organizations-page filter (name). */
export function visibleOrganizations(state: BackofficeState) {
  const query = state.organizationsPage.filter.trim().toLowerCase();
  if (!query) return state.organizations;
  return state.organizations.filter((organization) =>
    organization.name.toLowerCase().includes(query),
  );
}
