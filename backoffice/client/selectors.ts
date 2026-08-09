import type { BackofficeState } from "./state.js";

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
