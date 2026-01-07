import { NodeId, NodeType } from "./timeline";

export interface NodeSlide {
  id: NodeId;
  title: string;
  subtitle?: string;
  role: NodeType;
  description: string;
  inputs: string[];
  outputs: string[];
  valueForDesigners?: string;
  valueForVendors?: string;
  valueForFolio?: string;
  metricsExamples?: string[];
  futureState?: string;
}

export const NODE_SLIDES: Record<NodeId, NodeSlide> = {
  designers: {
    id: "designers",
    title: "Designers",
    subtitle: "The gravitational center of Folio.",
    role: "designer",
    description:
      "Designers are the authors of the system. Every project, tag, and decision they make becomes training data for their own Folio fingerprint.",
    inputs: [
      "Existing projects and photography sitting in folders, drives, and Instagram",
      "In-progress work they're willing to document as they go",
      "Basic profile information: markets, styles, price points",
    ],
    outputs: [
      "A living portfolio that can be searched, recombined, and published as stories",
      "A growing design fingerprint: what they show, choose, and consistently avoid",
      "Eligibility for editorial features, events, and Atelier-based earnings",
    ],
    valueForDesigners:
      "Turns scattered work into a compounding asset that can be discovered and monetized. Builds a personal design fingerprint without extra effort—just by doing their job. Creates leverage in conversations with vendors, clients, and media.",
    valueForVendors:
      "Surfaces designers who actually move product in their category, not just those with big follower counts. Reveals patterns in how top designers combine materials and brands in real clients' homes.",
    valueForFolio:
      "Designers are the source of truth—the more they ship, the stronger every loop in the system becomes.",
    metricsExamples: [
      "Active designers publishing at least one project per quarter",
      "Average projects per designer and per market",
      "Share of designer work that has a complete 'fingerprint trail' (projects + tags + editorials)",
    ],
    futureState:
      "Designer fingerprint models personalize Atelier outputs and recommendations for each designer and their audience.",
  },
  projects: {
    id: "projects",
    title: "Projects",
    subtitle: "The atomic unit of work, story, and monetization.",
    role: "designer",
    description:
      "Projects bundle rooms, photos, materials, and narrative into a single object. They are the container from which editorials, moodboards, and shoppable stories are derived.",
    inputs: ["Designer uploads", "Room-level structure"],
    outputs: ["Tagged media for editorials", "Materials library entries"],
    valueForDesigners:
      "A single source of truth to organize all visual and material decisions for a job, and a lever to generate editorials, spec sheets, and client presentations.",
    valueForVendors:
      "Clear, contextual evidence of how and where their products are used in real projects, with performance data attached.",
    valueForFolio:
      "Each project enriches the global design graph: connecting materials, vendors, price points, and styles to real-world outcomes.",
    metricsExamples: [
      "Projects created per month",
      "Avg. tagged products per project",
      "Projects converted into editorials",
    ],
    futureState:
      "Projects become the anchor for live collaboration, homeowner views, and post-occupancy insights.",
  },
  tags: {
    id: "tags",
    title: "Tags & Materials",
    subtitle: "Turning pretty pictures into structured, shoppable data.",
    role: "designer",
    description:
      "Tagging connects project imagery to materials, products, and vendors. This is where inspiration becomes structured data that can drive discovery, analytics, and revenue.",
    inputs: ["Designer-applied tags", "Computer vision assists"],
    outputs: ["Materials library", "Usage signals per product"],
    valueForDesigners:
      "A living materials library built passively while they work, making it easy to reuse favorites and discover similar products.",
    valueForVendors:
      "A high-resolution view of where, how, and with whom their products appear in real design work.",
    valueForFolio:
      "Tags are the spine of the data model, powering Atelier, marketplace matching, and vendor analytics.",
    metricsExamples: [
      "Tags per project",
      "Tagged vs. untagged media ratio",
      "Top tagged materials/products",
    ],
    futureState:
      "Semi-automatic tagging pipelines and bulk attribution from video, audio, and editorials.",
  },
  editorials: {
    id: "editorials",
    title: "Editorials",
    subtitle: "Turning projects into narrative, influence, and demand.",
    role: "designer",
    description:
      "Folio editorials are long-form, shoppable stories built directly from designer projects, tags, and vendor products. They bridge the gap between inspiration, education, and purchase.",
    inputs: ["Tagged projects", "Designer commentary"],
    outputs: ["Discovery traffic", "High-intent product clicks"],
    valueForDesigners:
      "Elevates their work beyond a static portfolio into a magazine-quality narrative that drives followers, clients, and earnings.",
    valueForVendors:
      "Context-rich placements in real spaces, with measurable engagement and paths to spec and purchase.",
    valueForFolio:
      "Creates an evergreen content layer that drives traffic, feeds the recommendation engine, and justifies vendor spend.",
    metricsExamples: [
      "Editorial reads",
      "Click-through rate to products",
      "Vendor boost revenue per editorial",
    ],
    futureState:
      "Atelier drafts editorials from project data, letting designers review and approve before publishing.",
  },
  vendors: {
    id: "vendors",
    title: "Vendors",
    subtitle: "The brands funding the ecosystem.",
    role: "vendor",
    description:
      "Vendors bring products, marketing budgets, and showhouse/event presence onto Folio. They benefit from rich analytics and placements inside real designer work.",
    inputs: ["Vendor onboarding", "Product catalogs"],
    outputs: ["Usage analytics", "Designer matches"],
    valueForDesigners:
      "More access to unique products, sponsored opportunities, and financial upside when their work performs.",
    valueForVendors:
      "Targeted distribution directly into the workflows, projects, and audiences that matter.",
    valueForFolio:
      "Primary source of B2B revenue and a constant source of data on which products resonate in which design contexts.",
    metricsExamples: [
      "Active vendors",
      "Avg. products per vendor",
      "Boost spend per vendor",
    ],
    futureState:
      "Deeper integrations with sampling, logistics, and marketplace transactions.",
  },
  products: {
    id: "products",
    title: "Products",
    subtitle: "From SKU lists to living, contextual objects.",
    role: "vendor",
    description:
      "Products start as SKUs, but on Folio they become contextualized items linked to real spaces, designers, and performance.",
    inputs: ["Ingested catalogs", "Vendor data"],
    outputs: ["Usage analytics", "Workflow recommendations"],
    valueForDesigners:
      "A curated set of proven products surfaced based on style, performance, and their own fingerprint.",
    valueForVendors:
      "A view into where each product lives in the design universe—not just impressions, but placements.",
    valueForFolio:
      "A product graph that connects brands, designers, and outcomes, powering every monetization surface.",
    metricsExamples: [
      "Products with at least one tagged usage",
      "Top-performing SKUs by editorial performance",
      "Conversion from view to spec/save",
    ],
    futureState:
      "Dynamic performance badges and predictive recommendations for new products.",
  },
  boosts: {
    id: "boosts",
    title: "Boosts & Promotions",
    subtitle: "Paid energy injected into the flywheel.",
    role: "vendor",
    description:
      "Boosts let vendors promote specific projects, products, or editorials to high-intent audiences—designers, trade, or homeowners—without destroying the integrity of the content.",
    inputs: ["Vendor budgets", "Performance signals"],
    outputs: ["Increased discovery", "Designer earnings"],
    valueForDesigners:
      "A way to earn more when their work drives attention and sales, without creating ads themselves.",
    valueForVendors:
      "An efficient, content-native way to increase exposure around the projects, designers, and products that matter.",
    valueForFolio:
      "Recurring, scalable revenue directly tied to performance, anchored in real content instead of generic ad units.",
    metricsExamples: [
      "Boosted impressions vs. organic",
      "Cost per engaged view / click",
      "Designer earnings from boosted content",
    ],
    futureState:
      "Always-on boost strategies that automatically allocate spend to top-performing combinations of designers, products, and editorials.",
  },
  events: {
    id: "events",
    title: "Events & Education",
    subtitle: "Offline and online moments that deepen the graph.",
    role: "platform",
    description:
      "Events—both physical and digital—are where vendors and designers connect around specific products and themes. They drive retention, richer tagging, and new editorial opportunities.",
    inputs: ["Vendor sponsorship", "Designer attendance"],
    outputs: ["New projects", "Segmented audiences"],
    valueForDesigners:
      "High-value learning, access to vendors, and a reason to return to the platform and create more work.",
    valueForVendors:
      "A trackable way to see which designers and products perform best when attention is focused.",
    valueForFolio:
      "A recurring retention and data engine that enriches the graph and justifies deeper vendor spend.",
    metricsExamples: [
      "Events hosted per quarter",
      "Attendance vs. engagement",
      "Post-event project and tag lift",
    ],
    futureState:
      "Programmatic event series tied to specific cohorts, regions, and product categories.",
  },
  discovery: {
    id: "discovery",
    title: "Discovery",
    subtitle: "The surface where everything becomes visible.",
    role: "platform",
    description:
      "Discovery is the set of feeds, search experiences, and recommendation surfaces where designers, vendors, and (eventually) homeowners see Folio content.",
    inputs: ["Editorial signals", "Tagged content"],
    outputs: ["Views and engagement", "Traffic to projects/products"],
    valueForDesigners:
      "A place where their work is surfaced to the right audience, not just thrown into a generic feed.",
    valueForVendors:
      "A distribution lens that shows not only who saw what, but in what context and with what outcome.",
    valueForFolio:
      "The main attention surface that all other loops feed into and draw strength from.",
    metricsExamples: [
      "Views per editorial / project",
      "CTR to product and vendor surfaces",
      "Engagement by cohort",
    ],
    futureState:
      "Personalized discovery tuned by designer fingerprint, vendor goals, and homeowner intent.",
  },
  atelier: {
    id: "atelier",
    title: "Folio Atelier",
    subtitle: "The AI engine that only unlocks once the system is alive.",
    role: "platform",
    description:
      "Folio Atelier is the AI studio built on top of the graph. It learns from designer fingerprints, real projects, and vendor data to co-create layouts, narratives, and specs.",
    inputs: [
      "Designer fingerprints derived from projects, tags, and editorial tone",
      "Vendor constraints: price bands, availability, hero SKUs, and priorities",
      "Live performance data from editorials, boosts, and events",
    ],
    outputs: [
      "Drafted editorials and captions in each designer's voice",
      "Moodboards, room concepts, and spec suggestions tuned to their real portfolio",
      "AI-assisted briefs and shoppable boards for clients who may never have hired a designer before",
    ],
    valueForDesigners:
      "Gives them a personal AI 'second brain' trained on their actual work, not generic prompts. Lets them serve more clients without diluting quality—especially smaller projects they used to turn away. Creates new passive income: past projects and stories keep earning as Atelier reuses them intelligently.",
    valueForVendors:
      "Places their products into AI-generated concepts that match real-world constraints and designer taste. Creates a constant stream of new, on-brief contexts where their products can perform.",
    valueForFolio:
      "Transforms the platform from a place to look at design into a place that actively *produces* design and demand. Enables premium Atelier tiers, and lifts every other revenue line through better matches and faster production.",
    metricsExamples: [
      "Atelier sessions per designer and per project",
      "Conversion rate from AI-generated concepts to published stories or specs",
      "Share of earnings attributed to Atelier-assisted content and clients",
    ],
    futureState:
      "Monetized Atelier tiers where designers and vendors pay for higher volumes of AI outputs, personalization, and automation.",
  },
  earnings: {
    id: "earnings",
    title: "Earnings & Economics",
    subtitle: "Where value crystallizes—for designers, vendors, and Folio.",
    role: "platform",
    description:
      "This node captures the economic flows: affiliate revenue, boosts, sponsorships, and future marketplace transactions. It shows that Folio is not just a portfolio or inspiration tool, but an economic engine.",
    inputs: ["Vendor boosts", "Affiliate conversions"],
    outputs: ["Designer payouts", "Vendor ROI signals"],
    valueForDesigners:
      "A direct financial upside to doing what they already do—documenting their work and sharing their expertise.",
    valueForVendors:
      "Clear, attributable outcomes: sales, specs, and qualified relationships with designers.",
    valueForFolio:
      "A diversified revenue stack that scales with the health and density of the ecosystem, not just seat licenses.",
    metricsExamples: [
      "Total designer earnings",
      "Vendor spend by channel (boosts/editorials/events)",
      "Revenue per active designer/vendor",
    ],
    futureState:
      "Dynamic pricing and revenue shares driven by demand, virality, and fingerprint-level attribution.",
  },
};

