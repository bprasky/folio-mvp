import type { NodeId, EdgeId } from "./timeline";

export interface PresentStep {
  id: string;
  index: number;
  time: number; // 0..60, used with getSceneState
  label: string; // short phase title
  caption: string; // what the founder would say here
  focusNode?: NodeId;
  focusEdge?: EdgeId;
}

export const PRESENT_STEPS: PresentStep[] = [
  {
    id: "fingerprint-begins",
    index: 0,
    time: 3,
    label: "Day 0: your fingerprint starts forming",
    caption:
      "From the very first project a designer uploads, Folio starts building a fingerprint: what they show, what they tag, what they reject. It still feels like a simple portfolio tool—but under the surface, we're already learning their taste, process, and range.",
    focusNode: "designers",
  },
  {
    id: "projects-as-dna",
    index: 1,
    time: 9,
    label: "Projects become design DNA",
    caption:
      "Every project is a block of design DNA: rooms, constraints, budgets, 'this client loved this, that client said no'. Instead of dead case studies, projects here are living objects the system can read, compare, and reuse. The more they ship, the sharper their fingerprint becomes.",
    focusNode: "projects",
  },
  {
    id: "graph-wakes-up",
    index: 2,
    time: 16,
    label: "The material graph wakes up",
    caption:
      "As designers tag real products and materials, the graph wakes up. We're no longer just storing pretty photos—we know which stones, woods, fixtures, and brands actually show up together in successful rooms. This is where the industry quietly shifts from moodboard to data.",
    focusNode: "tags",
  },
  {
    id: "editorial-engine",
    index: 3,
    time: 24,
    label: "Editorials: portfolios become media properties",
    caption:
      "Once the graph is dense enough, we start minting editorials directly from designer work. Their projects become magazine-quality stories with shoppable context. For designers, this is the first 'oh' moment: my portfolio is now a media property that can be discovered, shared, and monetized.",
    focusNode: "editorials",
  },
  {
    id: "vendor-economy",
    index: 4,
    time: 32,
    label: "Vendors attach a real economy to the graph",
    caption:
      "Vendors plug in with real catalogs and real budgets. They don't just buy banner ads—they boost the designers, projects, and editorials that are already working. Suddenly, the same work that used to die on Instagram becomes an earning asset for the designer and a live testbed for the brand.",
    focusNode: "vendors",
  },
  {
    id: "events-retention",
    index: 5,
    time: 40,
    label: "Events & programming lock in retention",
    caption:
      "Events tie everything together in the real world. The best rooms, products, and designers become the backbone of salons, showhouses, and private sessions. Those moments feed back into new projects, richer tagging, and deeper stories. Designers stop 'trying' Folio and start needing it as a hub.",
    focusNode: "events",
  },
  {
    id: "atelier-unveiling",
    index: 6,
    time: 49,
    label: "The unveiling: Folio Atelier comes online",
    caption:
      "At a certain density, we flip the switch on Folio Atelier. Now the fingerprint matters: Atelier can draft in each designer's voice, suggest materials they would actually use, and pull the right vendors into the frame automatically. Designers earn while they sleep because their past work is training their own AI studio.",
    focusNode: "atelier",
  },
  {
    id: "new-demand",
    index: 7,
    time: 56,
    label: "Unlocking clients who never hired designers before",
    caption:
      "Here's the breakthrough: Atelier doesn't just make current designers faster. It unlocks an entire tier of clients who would never have hired a designer at all. They arrive through moodboards, shoppable stories, and AI-guided briefs—and Folio routes them to the right designer, products, and vendors by default.",
    focusNode: "discovery",
  },
  {
    id: "mature-flywheel",
    index: 8,
    time: 59,
    label: "Mature flywheel: designers, vendors, and AI all compounding",
    caption:
      "In the mature state, every project, tag, editorial, event, and Atelier session reinforces the rest. Designers see Folio as where they publish, earn, and train their own AI. Vendors see it as where they learn what to build and where to invest. And the client at the end of this chain just experiences better spaces, faster.",
    focusNode: "earnings",
  },
];

