// Single source of truth for organization roles + their capabilities.
// Every gate — server-side route handler, client-side UI affordance,
// and the matrix rendered on /org/[orgId]/settings — reads from here.
// If two surfaces ever disagree, this file wins.

export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

// Display order: top of the matrix is "highest privilege."
export const ORG_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_TAGLINE: Record<OrgRole, string> = {
  OWNER:
    'Founder seat. One per org. Holds billing and can transfer ownership.',
  ADMIN:
    'Co-leader. Everything Owner can do except billing and transferring ownership.',
  MANAGER:
    'Trusted lieutenant. Grows the team and publishes work, but cannot change leadership or delete projects.',
  MEMBER:
    'Internal contributor. Works on projects and is credited publicly.',
  VIEWER:
    'Read-only seat (mentor, advisor, bookkeeper). Can be credited on the public team page; cannot edit anything.',
};

export type OrgCapability =
  | 'billing'
  | 'transfer_ownership'
  | 'modify_owner'
  | 'edit_org_profile'
  | 'change_member_roles'
  | 'remove_members'
  | 'review_join_requests'
  | 'delete_projects'
  | 'publish_projects'
  | 'invite_members'
  | 'add_to_team_page'
  | 'create_and_edit_projects'
  | 'credited_on_team_page'
  | 'view_internal';

// Display order — highest-privilege capabilities at the top.
export const CAPABILITY_ORDER: OrgCapability[] = [
  'billing',
  'transfer_ownership',
  'modify_owner',
  'edit_org_profile',
  'change_member_roles',
  'remove_members',
  'review_join_requests',
  'delete_projects',
  'publish_projects',
  'invite_members',
  'add_to_team_page',
  'create_and_edit_projects',
  'credited_on_team_page',
  'view_internal',
];

export const CAPABILITY_LABEL: Record<OrgCapability, string> = {
  billing: 'Billing & subscription',
  transfer_ownership: 'Transfer ownership',
  modify_owner: 'Modify the Owner row',
  edit_org_profile: 'Edit org profile',
  change_member_roles: 'Change member roles',
  remove_members: 'Remove members',
  review_join_requests: 'Approve / decline join requests',
  delete_projects: 'Delete projects',
  publish_projects: 'Publish projects',
  invite_members: 'Invite members',
  add_to_team_page: 'Add members to public team page',
  create_and_edit_projects: 'Create & edit projects',
  credited_on_team_page: 'Credited on public team page',
  view_internal: 'View internal feed & projects',
};

// The matrix. To change what a role can do, edit ONLY this object.
const ROLE_CAPABILITIES: Record<OrgRole, ReadonlySet<OrgCapability>> = {
  OWNER: new Set<OrgCapability>([
    'billing',
    'transfer_ownership',
    'modify_owner',
    'edit_org_profile',
    'change_member_roles',
    'remove_members',
    'review_join_requests',
    'delete_projects',
    'publish_projects',
    'invite_members',
    'add_to_team_page',
    'create_and_edit_projects',
    'credited_on_team_page',
    'view_internal',
  ]),
  ADMIN: new Set<OrgCapability>([
    'edit_org_profile',
    'change_member_roles',
    'remove_members',
    'review_join_requests',
    'delete_projects',
    'publish_projects',
    'invite_members',
    'add_to_team_page',
    'create_and_edit_projects',
    'credited_on_team_page',
    'view_internal',
  ]),
  MANAGER: new Set<OrgCapability>([
    'publish_projects',
    'invite_members',
    'add_to_team_page',
    'create_and_edit_projects',
    'credited_on_team_page',
    'view_internal',
  ]),
  MEMBER: new Set<OrgCapability>([
    'create_and_edit_projects',
    'credited_on_team_page',
    'view_internal',
  ]),
  VIEWER: new Set<OrgCapability>([
    'credited_on_team_page',
    'view_internal',
  ]),
};

export function can(
  role: OrgRole | null | undefined,
  capability: OrgCapability,
  policy: { membersCanPublish: boolean } = { membersCanPublish: true }
): boolean {
  if (!role) return false;
  if (role === 'MEMBER' && capability === 'publish_projects') return policy.membersCanPublish;
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

// Useful for server-side route handlers that need to gate on capability
// against an OrganizationUser lookup.
export function isOrgRole(value: unknown): value is OrgRole {
  return (
    typeof value === 'string' &&
    (ORG_ROLES as readonly string[]).includes(value)
  );
}

export function canCreateFirmProject(role: OrgRole | null | undefined, orgType: string): boolean {
  return ['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR'].includes(orgType) && can(role, 'create_and_edit_projects');
}
