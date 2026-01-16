/**
 * Role and Organization Type Display Labels
 *
 * Centralized mapping for human-readable labels for Role and OrgType enums.
 * Use these throughout the application for consistent display.
 */

import type { Role, OrgType, ParticipantSide } from '@prisma/client';

/**
 * Human-readable labels for user roles
 */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  VENDOR: 'Vendor',
  DESIGNER: 'Interior Designer',
  HOMEOWNER: 'Homeowner', // Legacy - kept for backward compatibility
  GUEST: 'Guest',
  INDIVIDUAL: 'Individual',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
};

/**
 * Human-readable labels for organization types
 */
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  VENDOR: 'Vendor',
  DESIGN_FIRM: 'Design Firm',
  MANUFACTURER: 'Manufacturer',
  SHOWROOM: 'Showroom',
  CONTRACTOR: 'General Contractor / Builder',
  ARCHITECTURE_FIRM: 'Architecture Firm',
};

/**
 * Human-readable labels for participant sides
 */
export const PARTICIPANT_SIDE_LABELS: Record<ParticipantSide, string> = {
  DESIGNER: 'Designer',
  VENDOR: 'Vendor',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
};

/**
 * Mapping from Role to compatible OrgTypes
 * Defines which organization types a role can create or join
 */
export const ROLE_TO_ORG_TYPES: Record<Role, OrgType[]> = {
  ADMIN: ['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR', 'VENDOR', 'MANUFACTURER', 'SHOWROOM'],
  DESIGNER: ['DESIGN_FIRM'],
  ARCHITECT: ['ARCHITECTURE_FIRM'],
  BUILDER: ['CONTRACTOR'],
  VENDOR: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'],
  INDIVIDUAL: [],
  HOMEOWNER: [],
  GUEST: [],
};

/**
 * Mapping from OrgType to the Role that should be assigned
 * when a user creates/joins an organization of that type
 */
export const ORG_TYPE_TO_ROLE: Record<OrgType, Role> = {
  DESIGN_FIRM: 'DESIGNER',
  ARCHITECTURE_FIRM: 'ARCHITECT',
  CONTRACTOR: 'BUILDER',
  VENDOR: 'VENDOR',
  MANUFACTURER: 'VENDOR',
  SHOWROOM: 'VENDOR',
};

/**
 * Professional roles that can create organizations and projects
 * These are parallel roles with similar capabilities
 */
export const PROFESSIONAL_ROLES: Role[] = ['DESIGNER', 'ARCHITECT', 'BUILDER'];

/**
 * Check if a role is a professional role (can create projects, orgs, etc.)
 */
export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}

/**
 * Get the label for a role, with fallback
 */
export function getRoleLabel(role: Role | string): string {
  return ROLE_LABELS[role as Role] || role;
}

/**
 * Get the label for an org type, with fallback
 */
export function getOrgTypeLabel(orgType: OrgType | string): string {
  return ORG_TYPE_LABELS[orgType as OrgType] || orgType;
}

/**
 * Get the label for a participant side, with fallback
 */
export function getParticipantSideLabel(side: ParticipantSide | string): string {
  return PARTICIPANT_SIDE_LABELS[side as ParticipantSide] || side;
}
