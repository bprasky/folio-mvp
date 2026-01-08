// Define EventType locally since it may not be in Prisma schema yet
// This is used across multiple files for event type handling

export const EventType = {
  FESTIVAL: 'FESTIVAL',
  SHOWROOM: 'SHOWROOM',
  EXHIBITION: 'EXHIBITION',
  TALK: 'TALK',
  WORKSHOP: 'WORKSHOP',
  NETWORKING: 'NETWORKING',
  PARTY: 'PARTY',
  PANEL: 'PANEL',
  HAPPY_HOUR: 'HAPPY_HOUR',
  MEAL: 'MEAL',
  LAUNCH: 'LAUNCH',
  OPENING: 'OPENING',
  OTHER: 'OTHER',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];
