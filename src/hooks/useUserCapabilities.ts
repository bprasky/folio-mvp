'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { normalizeRole } from '@/lib/permissions';

/**
 * User type for the projects page
 * Based on the permission matrix:
 * - INDIVIDUAL: Can only save products into boards, create/organize rooms
 * - FREE_DESIGNER: Can add projects, tag photos (hidden on feed), AI interview, publish, etc.
 * - PAID_DESIGNER: All of above + AI image gen, visible tags + affiliate, enhanced directory
 */
export type UserType = 'INDIVIDUAL' | 'FREE_DESIGNER' | 'PAID_DESIGNER' | 'VENDOR' | 'ADMIN';

/**
 * Organization status type
 */
export type OrgStatus = 'UNCLAIMED' | 'CLAIMED' | 'PROFESSIONAL' | null;

/**
 * Capabilities object based on user type
 */
export interface UserCapabilities {
  // User classification
  userType: UserType;
  isDesigner: boolean;
  isPaidDesigner: boolean;
  isFreeDesigner: boolean;
  isIndividual: boolean;
  isVendor: boolean;
  isAdmin: boolean;

  // Organization context (for upgrade flows)
  orgId: string | null;
  orgName: string | null;
  orgStatus: OrgStatus;

  // Feature access (from permission matrix)
  canSaveProducts: boolean;
  canCreateRooms: boolean;
  canAddProjects: boolean;
  canTagPhotos: boolean;
  canPublishToFeed: boolean;
  canUseAIInterview: boolean;
  canGenerateImages: boolean;
  canShareToInstagram: boolean;
  canEarnAffiliate: boolean;
  canHaveDirectoryListing: boolean;
  hasEnhancedDirectoryListing: boolean;
  tagsVisibleOnFeed: boolean;

  // Stats visibility
  showPublishedStat: boolean;
  showProductsTaggedStat: boolean;
  showAffiliateClicks: boolean;
  showDirectoryLink: boolean;

  // Loading state
  isLoading: boolean;
}

/**
 * Organization info for capabilities
 */
interface OrgInfo {
  id: string | null;
  name: string | null;
  status: OrgStatus;
}

/**
 * Hook to get user capabilities based on their role and org membership
 * Uses session data to determine user type and available features
 */
export function useUserCapabilities(): UserCapabilities {
  const { data: session, status } = useSession();

  return useMemo(() => {
    const isLoading = status === 'loading';

    // Default to individual if no session
    if (!session?.user) {
      return getCapabilitiesForType('INDIVIDUAL', isLoading, { id: null, name: null, status: null });
    }

    const role = normalizeRole(session.user.role);
    const user = session.user as any;

    // Extract org info from session
    const orgInfo: OrgInfo = {
      id: user.operatingAsOrgId || null,
      name: user.operatingAsOrg?.name || null,
      status: user.operatingAsOrg?.status || null,
    };

    // Determine user type based on role and org membership
    let userType: UserType = 'INDIVIDUAL';

    // PRIORITY 1: If operating as an organization, use org-based capabilities
    // This takes precedence over personal role
    if (user.operatingAsOrgId || user.operatingAsOrg) {
      const isProfessional = user.operatingAsOrg?.status === 'PROFESSIONAL';
      userType = isProfessional ? 'PAID_DESIGNER' : 'FREE_DESIGNER';
    }
    // PRIORITY 2: Check personal role
    else if (role === 'ADMIN') {
      userType = 'ADMIN';
    } else if (role === 'VENDOR') {
      userType = 'VENDOR';
    } else if (role === 'DESIGNER') {
      // Check if they have a professional (paid) org
      const isProfessional = user.isProfessional === true ||
                            user.hasProfessionalOrg === true;
      userType = isProfessional ? 'PAID_DESIGNER' : 'FREE_DESIGNER';
    } else if (role === 'INDIVIDUAL' || role === 'HOMEOWNER') {
      // Check if user has any org membership (makes them a designer)
      if (user.organizationId) {
        userType = 'FREE_DESIGNER';
      } else {
        userType = 'INDIVIDUAL';
      }
    } else {
      // Fallback: Check if user has any org membership
      if (user.organizationId) {
        userType = 'FREE_DESIGNER';
      }
    }

    return getCapabilitiesForType(userType, isLoading, orgInfo);
  }, [session, status]);
}

/**
 * Get capabilities object for a given user type
 */
function getCapabilitiesForType(userType: UserType, isLoading: boolean, orgInfo: OrgInfo): UserCapabilities {
  const base = {
    userType,
    isLoading,
    isDesigner: userType === 'FREE_DESIGNER' || userType === 'PAID_DESIGNER',
    isPaidDesigner: userType === 'PAID_DESIGNER',
    isFreeDesigner: userType === 'FREE_DESIGNER',
    isIndividual: userType === 'INDIVIDUAL',
    isVendor: userType === 'VENDOR',
    isAdmin: userType === 'ADMIN',
    // Organization context
    orgId: orgInfo.id,
    orgName: orgInfo.name,
    orgStatus: orgInfo.status,
  };

  switch (userType) {
    case 'INDIVIDUAL':
      return {
        ...base,
        // Can do
        canSaveProducts: true,
        canCreateRooms: true,
        // Cannot do
        canAddProjects: false,
        canTagPhotos: false,
        canPublishToFeed: false,
        canUseAIInterview: false,
        canGenerateImages: false,
        canShareToInstagram: false,
        canEarnAffiliate: false,
        canHaveDirectoryListing: false,
        hasEnhancedDirectoryListing: false,
        tagsVisibleOnFeed: false,
        // Stats
        showPublishedStat: false,
        showProductsTaggedStat: false,
        showAffiliateClicks: false,
        showDirectoryLink: false,
      };

    case 'FREE_DESIGNER':
      return {
        ...base,
        // Can do
        canSaveProducts: true,
        canCreateRooms: true,
        canAddProjects: true,
        canTagPhotos: true,
        canPublishToFeed: true,
        canUseAIInterview: true,
        canShareToInstagram: true,
        canHaveDirectoryListing: true,
        // Cannot do
        canGenerateImages: false,
        canEarnAffiliate: false,
        hasEnhancedDirectoryListing: false,
        tagsVisibleOnFeed: false, // Hidden on feed for free
        // Stats
        showPublishedStat: true,
        showProductsTaggedStat: true,
        showAffiliateClicks: false,
        showDirectoryLink: true,
      };

    case 'PAID_DESIGNER':
      return {
        ...base,
        // Can do everything
        canSaveProducts: true,
        canCreateRooms: true,
        canAddProjects: true,
        canTagPhotos: true,
        canPublishToFeed: true,
        canUseAIInterview: true,
        canGenerateImages: true,
        canShareToInstagram: true,
        canEarnAffiliate: true,
        canHaveDirectoryListing: true,
        hasEnhancedDirectoryListing: true,
        tagsVisibleOnFeed: true, // Visible + affiliate for paid
        // Stats
        showPublishedStat: true,
        showProductsTaggedStat: true,
        showAffiliateClicks: true,
        showDirectoryLink: true,
      };

    case 'VENDOR':
    case 'ADMIN':
      // Full access for vendors and admins
      return {
        ...base,
        canSaveProducts: true,
        canCreateRooms: true,
        canAddProjects: true,
        canTagPhotos: true,
        canPublishToFeed: true,
        canUseAIInterview: true,
        canGenerateImages: true,
        canShareToInstagram: true,
        canEarnAffiliate: true,
        canHaveDirectoryListing: true,
        hasEnhancedDirectoryListing: true,
        tagsVisibleOnFeed: true,
        showPublishedStat: true,
        showProductsTaggedStat: true,
        showAffiliateClicks: true,
        showDirectoryLink: true,
      };

    default:
      return getCapabilitiesForType('INDIVIDUAL', isLoading);
  }
}

export default useUserCapabilities;
