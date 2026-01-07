/**
 * Demo Mode Guards
 * 
 * Utility functions to check if demo mode is active and handle demo-specific logic.
 * Used throughout the app to ensure demo@folio.com and other demo accounts work smoothly.
 */

/**
 * Check if the current user is a demo user
 */
export function isDemoUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return email === 'demo@folio.com' || email === 'designer@folio.com' || email === 'vendor@folio.com';
}

/**
 * Check if demo mode is enabled via environment variable
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FOLIO_DEMO_MODE === 'true' || process.env.FOLIO_DEMO_MODE === 'true';
}

/**
 * Check if we should use demo data/logic
 */
export function shouldUseDemoMode(email?: string | null): boolean {
  return isDemoModeEnabled() || (email ? isDemoUser(email) : false);
}

/**
 * Get demo designer ID (for demo@folio.com to hire)
 * Returns designer@folio.com's ID if it exists
 */
export async function getDemoDesignerId(): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const demoDesigner = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'designer@folio.com' },
          { role: 'DESIGNER' },
        ],
      },
      select: { id: true },
      take: 1,
    });
    return demoDesigner?.id || null;
  } catch (error) {
    console.warn('[demoModeGuards] Failed to fetch demo designer:', error);
    return null;
  }
}

/**
 * Ensure demo users exist in the database
 * Call this during app initialization or seed scripts
 */
export async function ensureDemoUsers(): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    // Ensure demo@folio.com (Individual)
    await prisma.user.upsert({
      where: { email: 'demo@folio.com' },
      update: { role: 'INDIVIDUAL' },
      create: {
        email: 'demo@folio.com',
        name: 'Demo Individual',
        role: 'INDIVIDUAL',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK', // 'password123'
      },
    });

    // Ensure designer@folio.com
    await prisma.user.upsert({
      where: { email: 'designer@folio.com' },
      update: { role: 'DESIGNER' },
      create: {
        email: 'designer@folio.com',
        name: 'Demo Designer',
        role: 'DESIGNER',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK', // 'password123'
      },
    });

    // Ensure vendor@folio.com
    await prisma.user.upsert({
      where: { email: 'vendor@folio.com' },
      update: { role: 'VENDOR' },
      create: {
        email: 'vendor@folio.com',
        name: 'Demo Vendor',
        role: 'VENDOR',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK', // 'password123'
      },
    });

    console.log('[demoModeGuards] Demo users ensured');
  } catch (error) {
    console.error('[demoModeGuards] Failed to ensure demo users:', error);
  }
}




