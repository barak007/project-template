/**
 * The names actions and pages agree on. A page asks "is this pending?" and an
 * action says "this is pending" about the same control, so the two strings have
 * to be one string — spelling them here is what makes a rename a compile error
 * instead of a button that never stops spinning.
 *
 * Reads are keyed by the collection *and* the organization: switching
 * organizations empties the slices (domain-client/projection.ts), so what was
 * loaded for one is not loaded for the next.
 */
export const loadKeys = {
  organizations: "organizations",
  workspaces: (organizationId: string) => `workspaces:${organizationId}`,
  repositories: (organizationId: string) => `repositories:${organizationId}`,
  sessions: (organizationId: string) => `sessions:${organizationId}`,
  members: (organizationId: string) => `members:${organizationId}`,
  workspaceGrants: (workspaceId: string) => `grants:${workspaceId}`,
  invitations: (organizationId: string) => `invitations:${organizationId}`,
  /** The signed-in user's own inbox: one identity, so no id in the key. */
  inbox: "inbox",
} as const;

/** One key per control that can be in flight. */
export const actionKeys = {
  createOrganization: "organization.create",
  createWorkspace: "workspace.create",
  deleteWorkspace: (workspaceId: string) => `workspace.delete:${workspaceId}`,
  addRepository: "repository.add",
  removeRepository: (sourceId: string) => `repository.remove:${sourceId}`,
  createSession: (workspaceId: string) => `session.create:${workspaceId}`,
  changeRole: (userId: string) => `member.role:${userId}`,
  setVisibility: (workspaceId: string) => `workspace.visibility:${workspaceId}`,
  grantAccess: "workspace.grant",
  changeGrant: (userId: string) => `workspace.grant:${userId}`,
  removeGrant: (userId: string) => `workspace.grant.remove:${userId}`,
  invite: "invitation.send",
  revokeInvitation: (invitationId: string) =>
    `invitation.revoke:${invitationId}`,
  answerInvitation: (invitationId: string) =>
    `invitation.answer:${invitationId}`,
} as const;

/**
 * What a destructive control is waiting to be confirmed about. Separate from
 * `actionKeys` because a row is armed before anything is in flight.
 */
export const confirmKeys = {
  deleteWorkspace: (workspaceId: string) => `workspace.delete:${workspaceId}`,
  removeRepository: (sourceId: string) => `repository.remove:${sourceId}`,
  removeGrant: (userId: string) => `workspace.grant.remove:${userId}`,
  revokeInvitation: (invitationId: string) =>
    `invitation.revoke:${invitationId}`,
} as const;
