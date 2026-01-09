import { Role } from '@prisma/client';

/**
 * Content types that can be created in the system.
 * Mapped to the permission matrix for each user type.
 */
export type ContentType =
  | 'project'
  | 'article'
  | 'event'
  | 'collaborationStory'
  | 'feature'
  | 'edition'
  | 'trendPiece';

/**
 * Vendor tier levels for permission gating.
 * Since VendorTier isn't in Prisma schema yet, we define it here.
 * Can be migrated to Prisma enum when schema is updated.
 */
export type VendorTier = 'STANDARD' | 'PRO' | 'ENTERPRISE';

/**
 * Create action labels and routes for each content type.
 */
export const CREATE_ACTIONS: Record<
  ContentType,
  { label: string; href: string; description?: string }
> = {
  project: {
    label: 'New Project',
    href: '/projects/new',
    description: 'Create a new design project',
  },
  article: {
    label: 'New Article',
    href: '/designer/posts/new',
    description: 'Write an article or blog post',
  },
  event: {
    label: 'New Event',
    href: '/events/create',
    description: 'Create a vendor event',
  },
  collaborationStory: {
    label: 'New Collaboration Story',
    href: '/collaborations/new',
    description: 'Start a designer collaboration',
  },
  feature: {
    label: 'New Feature',
    href: '/admin/features/new',
    description: 'Create an editorial feature',
  },
  edition: {
    label: 'New Edition',
    href: '/admin/editions/new',
    description: 'Create a curated edition',
  },
  trendPiece: {
    label: 'New Trend Piece',
    href: '/admin/trends/new',
    description: 'Write a trend piece',
  },
};

/**
 * Permission Matrix:
 *
 * | User Type        | Can Create                              |
 * |------------------|----------------------------------------|
 * | Designer         | Projects, Articles                      |
 * | Vendor Standard  | Events                                  |
 * | Vendor Pro+      | Events, Collaboration Stories           |
 * | Folio Editorial  | Features, Editions, Trend Pieces        |
 * | Admin            | All content types                       |
 *
 * Key Rules:
 * - Designers cannot self-create Features (must be invited/earned)
 * - Vendors initiate Collaboration Stories (designers are invited)
 * - Features derive from Events after event date passes
 */
export function getCreatePermissions(
  role: Role | string | undefined | null,
  vendorTier?: VendorTier | string | null
): ContentType[] {
  // Normalize role to uppercase
  const normalizedRole = (role || 'GUEST').toString().toUpperCase();

  switch (normalizedRole) {
    case 'DESIGNER':
      // Designers can create projects and articles
      // Cannot self-create Features (must be invited/earned)
      return ['project', 'article'];

    case 'VENDOR': {
      const base: ContentType[] = ['event'];
      // Pro and Enterprise vendors can create Collaboration Stories
      const normalizedTier = vendorTier?.toString().toUpperCase();
      if (normalizedTier && ['PRO', 'ENTERPRISE'].includes(normalizedTier)) {
        base.push('collaborationStory');
      }
      return base;
    }

    case 'ADMIN':
      // Admins can create all content types
      return [
        'project',
        'article',
        'event',
        'collaborationStory',
        'feature',
        'edition',
        'trendPiece',
      ];

    case 'HOMEOWNER':
      // Homeowners can only create projects (their own design projects)
      return ['project'];

    case 'GUEST':
    default:
      // Guests and unknown roles cannot create anything
      return [];
  }
}

/**
 * Check if a user can create a specific content type.
 *
 * @param role - User's role
 * @param contentType - The type of content to create
 * @param vendorTier - Optional vendor tier for tier-gated features
 * @returns boolean indicating if creation is allowed
 */
export function canCreate(
  role: Role | string | undefined | null,
  contentType: ContentType,
  vendorTier?: VendorTier | string | null
): boolean {
  const permissions = getCreatePermissions(role, vendorTier);
  return permissions.includes(contentType);
}

/**
 * Get the create actions available for a user based on their role and tier.
 * Returns an array of action objects with label, href, and description.
 */
export function getCreateActions(
  role: Role | string | undefined | null,
  vendorTier?: VendorTier | string | null
): Array<{ label: string; href: string; description?: string; contentType: ContentType }> {
  const permissions = getCreatePermissions(role, vendorTier);
  return permissions.map((contentType) => ({
    ...CREATE_ACTIONS[contentType],
    contentType,
  }));
}

/**
 * Check if a content type requires a minimum vendor tier.
 * Returns the required tier or null if not tier-gated.
 */
export function getRequiredTier(contentType: ContentType): VendorTier | null {
  switch (contentType) {
    case 'collaborationStory':
      return 'PRO';
    default:
      return null;
  }
}

/**
 * Get upgrade prompt for tier-gated features.
 * Returns a message describing what tier is needed.
 */
export function getUpgradePrompt(contentType: ContentType): string | null {
  const requiredTier = getRequiredTier(contentType);
  if (!requiredTier) return null;

  const tierMessages: Record<VendorTier, string> = {
    STANDARD: 'Standard tier required',
    PRO: 'Upgrade to Pro to unlock Collaboration Stories',
    ENTERPRISE: 'Enterprise tier required',
  };

  return tierMessages[requiredTier];
}

/**
 * Check if user needs an upgrade prompt for a specific content type.
 */
export function needsUpgradeForContent(
  role: Role | string | undefined | null,
  contentType: ContentType,
  vendorTier?: VendorTier | string | null
): boolean {
  const normalizedRole = (role || 'GUEST').toString().toUpperCase();

  // Only vendors can have tier restrictions
  if (normalizedRole !== 'VENDOR') return false;

  const requiredTier = getRequiredTier(contentType);
  if (!requiredTier) return false;

  const normalizedTier = vendorTier?.toString().toUpperCase() || 'STANDARD';
  const tierOrder: Record<string, number> = {
    STANDARD: 1,
    PRO: 2,
    ENTERPRISE: 3,
  };

  return (tierOrder[normalizedTier] || 0) < (tierOrder[requiredTier] || 0);
}
