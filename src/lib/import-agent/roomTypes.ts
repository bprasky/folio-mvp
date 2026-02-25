/**
 * Shared room type constants used by import finalization, image analysis, and room creation.
 */

/** Maps analyzeImage() roomType strings to Prisma Room.type enum values */
export const ROOM_TYPE_TO_ENUM: Record<string, string> = {
  'living_room': 'LIVING',
  'bedroom': 'BEDROOM',
  'kitchen': 'KITCHEN',
  'bathroom': 'BATHROOM',
  'dining_room': 'DINING',
  'office': 'OFFICE',
  'entry': 'ENTRY',
  'outdoor': 'OUTDOOR',
  'hallway': 'HALLWAY',
  'laundry': 'LAUNDRY',
  'closet': 'CLOSET',
  'other': 'OTHER',
};

/** Human-readable display names for room types */
export const ROOM_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'living_room': 'Living Room',
  'bedroom': 'Bedroom',
  'kitchen': 'Kitchen',
  'bathroom': 'Bathroom',
  'dining_room': 'Dining Room',
  'office': 'Office',
  'entry': 'Entry',
  'outdoor': 'Outdoor',
  'hallway': 'Hallway',
  'laundry': 'Laundry',
  'closet': 'Closet',
  'other': 'Other',
};
