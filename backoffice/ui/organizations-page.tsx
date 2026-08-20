import type { BackofficeCore, TableRow } from "../client/index.js";

import { rowText, TablePage } from "./table-page.js";

/**
 * The organizations table page: the generic console plus a detail view and
 * a delete that clears restrict-prone work sessions before the cascade.
 */
export function OrganizationsPage({
  core,
  load,
  onOpen,
}: {
  core: BackofficeCore;
  load: (action: () => Promise<void>) => Promise<void>;
  onOpen: (organizationId: string) => void;
}) {
  return (
    <TablePage
      core={core}
      load={load}
      table="organizations"
      heading="Organizations"
      rowActions={(row: TableRow) => (
        <button
          onClick={() => {
            onOpen(rowText(row.id));
          }}
        >
          Open
        </button>
      )}
      deleteConfirm={(row) =>
        `Delete organization "${rowText(row.name)}" and everything in it ` +
        "(members, sources, workspaces, work sessions)? This cannot be undone."
      }
      deleteAction={(row) => core.admin.deleteOrganization(rowText(row.id))}
    />
  );
}
