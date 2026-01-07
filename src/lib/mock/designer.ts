export type DesignerProject = { id: string; name: string; rooms: { id: string; name: string }[] };

export const MOCK_PROJECTS: DesignerProject[] = [
  { id: "p_nyc_apt", name: "NYC Loft", rooms: [{ id: "r_living", name: "Living" }, { id: "r_bed1", name: "Primary Bedroom" }] },
  { id: "p_beach", name: "Miami Beach House", rooms: [{ id: "r_kitchen", name: "Kitchen" }, { id: "r_outdoor", name: "Outdoor" }] },
];

export function isDesigner(user?: { role?: string }) {
  return user?.role === "designer";
}