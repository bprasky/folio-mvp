/**
 * Vendor Presentation Analytics
 *
 * Tracks scroll depth, section views, time on page, and CTA clicks
 * for the vendor scroll presentations.
 */

import { prisma } from '@/lib/prisma';

/**
 * Create a new presentation view record.
 */
export async function trackPresentationView(
  organizationId: string,
  userId: string | null,
  type: 'rep' | 'admin'
): Promise<string> {
  const view = await prisma.vendorPresentationView.create({
    data: {
      organizationId,
      userId,
      presentationType: type,
    },
  });

  return view.viewToken;
}

/**
 * Update scroll depth and sections viewed.
 */
export async function updateScrollDepth(
  viewToken: string,
  depth: number,
  sectionsViewed: string[]
): Promise<void> {
  const existing = await prisma.vendorPresentationView.findUnique({
    where: { viewToken },
    select: { maxScrollDepth: true, sectionsViewed: true },
  });

  if (!existing) return;

  // Only update if deeper than previous max
  const newDepth = Math.max(existing.maxScrollDepth, Math.min(depth, 1));

  // Merge sections (keep unique)
  const allSections = Array.from(
    new Set([...existing.sectionsViewed, ...sectionsViewed])
  );

  await prisma.vendorPresentationView.update({
    where: { viewToken },
    data: {
      maxScrollDepth: newDepth,
      sectionsViewed: allSections,
    },
  });
}

/**
 * Update time on page.
 */
export async function updateTimeOnPage(
  viewToken: string,
  timeMs: number
): Promise<void> {
  await prisma.vendorPresentationView.update({
    where: { viewToken },
    data: { timeOnPageMs: timeMs },
  });
}

/**
 * Record which CTA was clicked.
 */
export async function trackCTAClick(
  viewToken: string,
  ctaId: string
): Promise<void> {
  await prisma.vendorPresentationView.update({
    where: { viewToken },
    data: { ctaClicked: ctaId },
  });
}
