export const EVENT_SELECT_BASE = {
  id: true,
  title: true,
  description: true,
  location: true,
  startDate: true,
  endDate: true,
  imageUrl: true,
  eventTypes: true,
  isPublic: true,
  isApproved: true,
  parentFestivalId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const EVENT_SELECT_FEED = {
  ...EVENT_SELECT_BASE,
  createdBy: { select: { id: true, name: true, companyName: true, role: true } },
  parentFestival: { select: { id: true, title: true, startDate: true, endDate: true } },
  _count: { select: { rsvps: true } },
} as const;

export const EVENT_SELECT_FULL = {
  ...EVENT_SELECT_BASE,
  linkedProducts: true,
  createdBy: { select: { id: true, name: true, companyName: true, role: true } },
  parentFestival: {
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startDate: true,
      endDate: true,
      imageUrl: true,
    },
  },
  rsvps: {
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, userId: true, createdAt: true, user: { select: { id: true, name: true } } },
  },
} as const; 