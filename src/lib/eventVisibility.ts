/**
 * Helper function to build Prisma where clause for event visibility based on user role
 * @param userRole - The user's role (ADMIN, VENDOR, DESIGNER, etc.)
 * @param userId - The user's ID (for filtering own events)
 * @param additionalFilters - Any additional filters to apply
 * @returns Prisma where clause object
 */
export function getVisibleEventsWhereClause(
  userRole?: string, 
  userId?: string, 
  additionalFilters: any = {}
): any {
  const baseFilters = {
    eventTypes: {
      hasSome: ['PANEL', 'PRODUCT_REVEAL', 'HAPPY_HOUR', 'LUNCH_AND_LEARN', 'INSTALLATION', 'BOOTH', 'PARTY', 'MEAL', 'TOUR', 'AWARDS', 'WORKSHOP', 'KEYNOTE', 'OTHER'] as any
    },
    startDate: { gte: new Date() },
    ...additionalFilters
  };

  // Role-based visibility logic
  if (userRole === 'ADMIN') {
    // Admins see all events (no additional filters)
    return baseFilters;
  } else if (userRole === 'VENDOR') {
    // Vendors see all public events + their own events
    return {
      ...baseFilters,
      OR: [
        { isPublic: true },
        { createdById: userId }
      ]
    };
  } else {
    // Designers, guests, and others see only approved public events
    return {
      ...baseFilters,
      isApproved: true,
      isPublic: true
    };
  }
}

/**
 * Check if a user can edit a specific event
 * @param event - The event to check
 * @param userRole - The user's role
 * @param userId - The user's ID
 * @returns boolean indicating if user can edit the event
 */
export function canEditEvent(event: any, userRole?: string, userId?: string): boolean {
  if (userRole === 'ADMIN') {
    return true; // Admins can edit all events
  }
  
  if (userRole === 'VENDOR' && event.createdById === userId) {
    return true; // Vendors can edit their own events
  }
  
  return false;
}

/**
 * Check if a user can delete a specific event
 * @param event - The event to check
 * @param userRole - The user's role
 * @param userId - The user's ID
 * @returns boolean indicating if user can delete the event
 */
export function canDeleteEvent(event: any, userRole?: string, userId?: string): boolean {
  if (userRole === 'ADMIN') {
    return true; // Admins can delete all events
  }
  
  if (event.createdById === userId) {
    return true; // Event creators can delete their own events
  }
  
  return false;
} 