export type NodeId =
  | "designers"
  | "projects"
  | "tags"
  | "editorials"
  | "vendors"
  | "products"
  | "boosts"
  | "events"
  | "discovery"
  | "atelier"
  | "earnings";

export type NodeType = "designer" | "vendor" | "platform";

export interface NodeDef {
  id: NodeId;
  label: string;
  type: NodeType;
  x: number; // 0..1
  y: number; // 0..1
}

export type EdgeId =
  | "designers-projects"
  | "projects-tags"
  | "tags-editorials"
  | "editorials-discovery"
  | "editorials-vendors"
  | "vendors-products"
  | "tags-products"
  | "products-boosts"
  | "boosts-discovery"
  | "boosts-earnings"
  | "events-projects"
  | "events-editorials"
  | "vendors-events"
  | "projects-atelier"
  | "tags-atelier"
  | "editorials-atelier"
  | "vendors-atelier"
  | "atelier-earnings";

export interface EdgeDef {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
}

export interface MetricsState {
  designers: number;
  projects: number;
  tags: number;
  editorials: number;
  vendors: number;
  products: number;
  boosts: number;
  events: number;
  discoveryViews: number;
  earningsUsd: number;
  atelierSessions: number;
}

export interface SceneState {
  nodeIntensity: Record<NodeId, number>; // 0..1
  metrics: MetricsState;
}

export const NODES: NodeDef[] = [
  { id: "designers", label: "Designers", type: "designer", x: 0.2, y: 0.42 },
  { id: "projects", label: "Projects", type: "designer", x: 0.32, y: 0.26 },
  { id: "tags", label: "Tags", type: "designer", x: 0.37, y: 0.6 },
  { id: "editorials", label: "Editorials", type: "designer", x: 0.5, y: 0.2 },
  { id: "discovery", label: "Discovery", type: "platform", x: 0.68, y: 0.2 },
  { id: "vendors", label: "Vendors", type: "vendor", x: 0.8, y: 0.42 },
  { id: "products", label: "Products", type: "vendor", x: 0.72, y: 0.64 },
  { id: "boosts", label: "Boosts", type: "vendor", x: 0.6, y: 0.76 },
  { id: "events", label: "Events", type: "platform", x: 0.45, y: 0.8 },
  { id: "earnings", label: "Earnings", type: "platform", x: 0.3, y: 0.72 },
  { id: "atelier", label: "Folio Atelier", type: "platform", x: 0.5, y: 0.48 },
];

export const EDGES: EdgeDef[] = [
  { id: "designers-projects", from: "designers", to: "projects" },
  { id: "projects-tags", from: "projects", to: "tags" },
  { id: "tags-editorials", from: "tags", to: "editorials" },
  { id: "editorials-discovery", from: "editorials", to: "discovery" },
  { id: "editorials-vendors", from: "editorials", to: "vendors" },
  { id: "vendors-products", from: "vendors", to: "products" },
  { id: "tags-products", from: "tags", to: "products" },
  { id: "products-boosts", from: "products", to: "boosts" },
  { id: "boosts-discovery", from: "boosts", to: "discovery" },
  { id: "boosts-earnings", from: "boosts", to: "earnings" },
  { id: "events-projects", from: "events", to: "projects" },
  { id: "events-editorials", from: "events", to: "editorials" },
  { id: "vendors-events", from: "vendors", to: "events" },
  { id: "projects-atelier", from: "projects", to: "atelier" },
  { id: "tags-atelier", from: "tags", to: "atelier" },
  { id: "editorials-atelier", from: "editorials", to: "atelier" },
  { id: "vendors-atelier", from: "vendors", to: "atelier" },
  { id: "atelier-earnings", from: "atelier", to: "earnings" },
];

const ALL_NODE_IDS: NodeId[] = NODES.map((n) => n.id);

const EMPTY_METRICS: MetricsState = {
  designers: 0,
  projects: 0,
  tags: 0,
  editorials: 0,
  vendors: 0,
  products: 0,
  boosts: 0,
  events: 0,
  discoveryViews: 0,
  earningsUsd: 0,
  atelierSessions: 0,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function getSceneState(time: number): SceneState {
  const t = time % 60;
  const intensity: Record<NodeId, number> = {} as any;
  ALL_NODE_IDS.forEach((id) => (intensity[id] = 0));
  let metrics: MetricsState = { ...EMPTY_METRICS };

  // 0–5s: cold start, first designers & projects
  if (t < 5) {
    const phase = t / 5;
    intensity.designers = phase * 0.6;
    intensity.projects = phase * 0.4;
    metrics.designers = Math.round(lerp(0, 5, phase));
    metrics.projects = Math.round(lerp(0, 8, phase));
    metrics.tags = Math.round(lerp(0, 40, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 5–15s: onboarding, projects, tags
  if (t < 15) {
    const phase = (t - 5) / 10;
    intensity.designers = 0.8;
    intensity.projects = 0.9;
    intensity.tags = 0.8;
    metrics.designers = Math.round(lerp(5, 10, phase));
    metrics.projects = Math.round(lerp(8, 18, phase));
    metrics.tags = Math.round(lerp(40, 140, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 15–25s: editorials + discovery
  if (t < 25) {
    const phase = (t - 15) / 10;
    intensity.designers = 0.7;
    intensity.projects = 0.8;
    intensity.tags = 0.9;
    intensity.editorials = phase;
    intensity.discovery = phase * 0.8;

    metrics.designers = 10;
    metrics.projects = 18;
    metrics.tags = 140;
    metrics.editorials = Math.round(lerp(0, 7, phase));
    metrics.discoveryViews = Math.round(lerp(0, 1500, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 25–35s: vendors + products + boosts
  if (t < 35) {
    const phase = (t - 25) / 10;
    intensity.editorials = 0.9;
    intensity.discovery = 0.9;
    intensity.vendors = phase;
    intensity.products = phase;
    intensity.boosts = phase * 0.8;
    intensity.earnings = phase * 0.6;

    metrics.designers = 14;
    metrics.projects = 26;
    metrics.tags = 220;
    metrics.editorials = 7;
    metrics.vendors = Math.round(lerp(0, 12, phase));
    metrics.products = Math.round(lerp(0, 2300, phase));
    metrics.boosts = Math.round(lerp(0, 9, phase));
    metrics.discoveryViews = Math.round(lerp(1500, 3800, phase));
    metrics.earningsUsd = Math.round(lerp(0, 1200, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 35–45s: events + compounding
  if (t < 45) {
    const phase = (t - 35) / 10;
    intensity.vendors = 0.9;
    intensity.products = 0.9;
    intensity.boosts = 0.9;
    intensity.editorials = 0.9;
    intensity.events = phase;
    intensity.projects = 0.9;
    intensity.tags = 0.9;
    intensity.earnings = 0.8;
    intensity.discovery = 0.9;

    metrics.designers = Math.round(lerp(14, 40, phase));
    metrics.projects = Math.round(lerp(26, 60, phase));
    metrics.tags = Math.round(lerp(220, 480, phase));
    metrics.editorials = Math.round(lerp(7, 18, phase));
    metrics.vendors = 12;
    metrics.products = 2300;
    metrics.boosts = 9;
    metrics.events = Math.round(lerp(0, 4, phase));
    metrics.discoveryViews = Math.round(lerp(3800, 9000, phase));
    metrics.earningsUsd = Math.round(lerp(1200, 5000, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 45–55s: Folio Atelier unlocks
  if (t < 55) {
    const phase = (t - 45) / 10;
    const atelierRing = clamp01(phase * 1.2);

    ALL_NODE_IDS.forEach((id) => {
      intensity[id] = 0.7;
    });
    intensity.atelier = atelierRing;

    metrics.designers = 60;
    metrics.projects = 90;
    metrics.tags = 820;
    metrics.editorials = 32;
    metrics.vendors = 18;
    metrics.products = 4100;
    metrics.boosts = 22;
    metrics.events = 7;
    metrics.discoveryViews = Math.round(lerp(9000, 24000, phase));
    metrics.earningsUsd = Math.round(lerp(5000, 18400, phase));
    metrics.atelierSessions = Math.round(lerp(0, 320, phase));
    return { nodeIntensity: intensity, metrics };
  }

  // 55–60s: final form, stable loop
  const phase = (t - 55) / 5;
  ALL_NODE_IDS.forEach((id, idx) => {
    intensity[id] = 0.6 + 0.2 * Math.sin((t + idx) * 0.7);
  });
  intensity.atelier = 1;

  metrics.designers = 70;
  metrics.projects = 110;
  metrics.tags = 1000;
  metrics.editorials = 40;
  metrics.vendors = 25;
  metrics.products = 5200;
  metrics.boosts = 35;
  metrics.events = 9;
  metrics.discoveryViews = 30000;
  metrics.earningsUsd = 25000;
  metrics.atelierSessions = 500;

  return { nodeIntensity: intensity, metrics };
}

