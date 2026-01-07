export type EventLike = { id: string };
export const eventHref = (ev: EventLike) => `/events/${ev.id}`; 