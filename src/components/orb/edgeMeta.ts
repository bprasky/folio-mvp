// Folio System Orb: edges between nodes powering the "CONNECTION" panel
import type { EdgeId, NodeId } from "./timeline";

export interface EdgeMeta {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  label: string; // short phrase, e.g. "Projects feed tags"
  description: string; // 1–2 sentence causal explanation
  valueForDesigners?: string;
  valueForVendors?: string;
  valueForFolio?: string;
  metricsExamples?: string[];
  scenarioExample?: string; // 1 concrete "for example"
}

export const EDGE_META: Partial<Record<EdgeId, EdgeMeta>> = {
  "designers-projects": {
    id: "designers-projects",
    from: "designers",
    to: "projects",
    label: "Designers create structured projects",
    description:
      "Designers turn raw work into structured projects on Folio. Projects are the atomic unit of their portfolio and the main canvas where tags, products, and narratives are attached.",
    valueForDesigners:
      "Gives designers a persistent, organized home for each job instead of scattered screenshots. Every project they create becomes fuel for discovery, editorials, and Folio Atelier training. The more projects they publish, the more surfaces of the flywheel they unlock (income, reach, and tooling).",
    valueForVendors:
      "Projects show exactly where and how their products get used in real spaces. Makes it easy to identify power users and potential ambassadors based on real job history.",
    scenarioExample:
      "A designer uploads a kitchen remodel as a project, tags the materials and vendors, and later that same project is surfaced in editorials, discovery feeds, and shared with vendors as proof of performance.",
  },
  "tags-editorials": {
    id: "tags-editorials",
    from: "tags",
    to: "editorials",
    label: "Tagged materials → editorial storylines",
    description:
      "The denser and cleaner the tagging in a project, the easier it is for Folio to generate editorials that are specific, shoppable, and useful.",
    valueForDesigners:
      "Well-tagged projects translate into richer editorials with better earnings potential.",
    valueForVendors:
      "Their products show up in deep dives that feel authored, not like ads.",
    valueForFolio:
      "High-quality tags make editorials cheaper to produce and more likely to convert.",
    metricsExamples: [
      "Editorials per highly-tagged project",
      "CTR from tagged callouts",
    ],
    scenarioExample:
      "A kitchen with meticulously tagged stone, hardware, and lighting yields a 'Material Story' editorial with clear product callouts.",
  },
  "editorials-vendors": {
    id: "editorials-vendors",
    from: "editorials",
    to: "vendors",
    label: "Editorials generate vendor demand",
    description:
      "When an editorial performs, vendors see which products and narratives drive interest and can respond with boosts, campaigns, or new collections.",
    metricsExamples: [
      "Vendor boost rate on top 10 editorials",
      "New vendor inquiries per editorial series",
    ],
    scenarioExample:
      "A stone brand notices a bathroom editorial outperforming others and boosts it regionally to specifiers.",
  },
  "editorials-discovery": {
    id: "editorials-discovery",
    from: "editorials",
    to: "discovery",
    label: "Editorials drive discovery traffic",
    description:
      "Editorials are the primary content surface that brings designers, vendors, and homeowners into the discovery experience, creating engagement loops.",
    valueForDesigners:
      "Editorials amplify their work beyond their immediate network, driving new followers and clients.",
    valueForVendors:
      "Editorials create high-intent discovery moments where their products are contextually relevant.",
    valueForFolio:
      "Editorials are the content engine that powers discovery, creating reasons to return and explore.",
    scenarioExample:
      "A well-performing editorial about sustainable materials drives thousands of discovery views and product saves.",
  },
  "products-boosts": {
    id: "products-boosts",
    from: "products",
    to: "boosts",
    label: "Products enable targeted boosts",
    description:
      "Boosts are paid or sponsored amplification of content. This edge represents where vendors choose to put budget (on specific projects, editorials, or events) and how that spend flows back into the system.",
    valueForVendors:
      "Lets them promote their best placements to the right audiences, and measure ROI in a closed loop (views → saves → specs). Over time, vendors can see which types of content are worth boosting and which designers overperform.",
    valueForDesigners:
      "Boosted projects and editorials bring more views, saves, and downstream work. Designers whose content performs well under boosts become obvious partners for recurring campaigns.",
    scenarioExample:
      "A vendor boosts a kitchen editorial that heavily features their countertop line. The boosted piece drives more traffic to related products and new project files referencing that same product.",
  },
  "boosts-discovery": {
    id: "boosts-discovery",
    from: "boosts",
    to: "discovery",
    label: "Boosts amplify discovery",
    description:
      "Boosted content gets prioritized in discovery feeds, increasing visibility for both the content and the products/vendors featured in it.",
    valueForDesigners:
      "Boosted projects and editorials reach wider audiences, driving more engagement and potential clients.",
    valueForVendors:
      "Boosts ensure their products appear in high-intent discovery moments, not just passive browsing.",
    scenarioExample:
      "A boosted editorial about sustainable materials appears at the top of discovery feeds, driving thousands of views and product saves.",
  },
  "boosts-earnings": {
    id: "boosts-earnings",
    from: "boosts",
    to: "earnings",
    label: "Boosts create earnings for designers and Folio",
    description:
      "Boost campaigns generate revenue that flows to designers (for participating work) and to Folio (platform revenue).",
    valueForDesigners:
      "A direct financial upside when their work drives attention and sales.",
    valueForVendors:
      "An efficient, content-native way to increase exposure around projects and products that matter.",
    valueForFolio:
      "Recurring, scalable revenue directly tied to performance, anchored in real content.",
    scenarioExample:
      "A boosted editorial drives $500 in affiliate revenue, with $200 going to the designer and $300 to Folio.",
  },
  "atelier-earnings": {
    id: "atelier-earnings",
    from: "atelier",
    to: "earnings",
    label: "Atelier unlocks premium revenue",
    description:
      "Once Atelier is active, it enables higher-value outputs (better editorials, personalized recommendations) that justify premium pricing and marketplace transactions.",
    valueForDesigners:
      "Atelier-powered features can be monetized, creating new revenue streams.",
    valueForVendors:
      "AI-powered matching and recommendations drive higher conversion rates.",
    valueForFolio:
      "Atelier becomes a defensible moat and a premium revenue tier.",
    scenarioExample:
      "Atelier drafts a high-performing editorial that drives $2K in affiliate revenue, justifying premium Atelier subscription pricing.",
  },
  "projects-tags": {
    id: "projects-tags",
    from: "projects",
    to: "tags",
    label: "Projects generate tagged materials",
    description:
      "Tags turn projects into structured, searchable data. They express materials, styles, rooms, and themes in a machine-readable way.",
    valueForDesigners:
      "Makes it trivial to find 'that stone slab' or 'that neutral living room' across their entire body of work. Tagging once keeps paying off: it improves search, recommendations, and future Atelier prompts.",
    valueForVendors:
      "Tags reveal how and where their products are described in the wild (e.g. 'Calacatta marble island'). Lets vendors see the language designers actually use around their products.",
    scenarioExample:
      "A designer tags a bathroom project with 'travertine,' 'spa,' and 'warm neutral.' Later, another designer search, editorial tooling, and vendors can all find that exact look via tags.",
  },
  "tags-products": {
    id: "tags-products",
    from: "tags",
    to: "products",
    label: "Tags connect to product catalog",
    description:
      "Tags connect real designer language to vendor product catalogs. They create the bridge between inspiration and purchase.",
    valueForDesigners:
      "Designers can search and specify products using natural language and visual tags, not just SKU codes. When they reuse a tag (e.g. 'fluted stone'), Folio can suggest products that previous designers validated.",
    valueForVendors:
      "Surfaces their products wherever the underlying designer intent matches, even if the designer didn't know the brand name. Over time, shows which tags reliably pull their products into projects (true demand signals).",
    scenarioExample:
      "A designer tags 'marble countertop' and sees matching products from three vendors, with usage examples from other projects that used those SKUs.",
  },
  "vendors-products": {
    id: "vendors-products",
    from: "vendors",
    to: "products",
    label: "Vendors supply product catalogs",
    description:
      "Every product belongs to a vendor. This edge ties individual SKUs back to the brand that manufactures or supplies them.",
    valueForDesigners:
      "Lets them move from a single product they love into the broader vendor universe: similar SKUs, finishes, and lines. Makes it easy to discover new vendors through products surfaced in projects and editorials.",
    valueForVendors:
      "Gives vendors a live map of where their catalog is used: in which projects, by which designers, and in what context. Allows them to promote hero products and see how boosts affect downstream usage.",
    scenarioExample:
      "A designer clicks into a stone slab they've tagged and lands on the vendor profile, seeing other projects that used the same material and related options from the same supplier.",
  },
  "events-projects": {
    id: "events-projects",
    from: "events",
    to: "projects",
    label: "Events seed future projects",
    description:
      "Events seed future projects. Designers bring what they saw and learned at events back into their pipeline of work.",
    valueForDesigners:
      "Creates a direct path from 'I saw this at an event' to 'here's how I used it in a real job.' Projects that came out of events are natural candidates for boosts and editorials.",
    valueForVendors:
      "Shows which events actually drove spec: you can see the before-and-after of product usage tied to specific events.",
    scenarioExample:
      "After a sustainable materials festival, 15 designers create new projects featuring eco-focused products they found at the event. Vendors can see that path end-to-end.",
  },
  "events-editorials": {
    id: "events-editorials",
    from: "events",
    to: "editorials",
    label: "Events generate editorial opportunities",
    description:
      "Events create rich content that can be turned into editorials: showhouse tours, product launches, designer spotlights, and educational deep-dives.",
    valueForDesigners:
      "Events provide editorial-worthy content that showcases their work in context, driving long-term visibility.",
    valueForVendors:
      "Event-based editorials create high-context placements that feel authentic and timely, not like generic product features.",
    scenarioExample:
      "A showhouse event generates an editorial series featuring each designer's space, with full product credits and vendor links, driving sustained traffic for months.",
  },
  "vendors-events": {
    id: "vendors-events",
    from: "vendors",
    to: "events",
    label: "Vendors sponsor and participate in events",
    description:
      "Vendors fund and participate in events (showhouses, product launches, educational sessions) that bring designers into real-world experiences.",
    valueForVendors:
      "They can see which designers show up, engage, and convert event exposure into real projects. Events create measurable ROI through project creation and product usage.",
    valueForDesigners:
      "Events provide inspiration, access to materials, and real relationships with vendors. Attendance and engagement can later influence boosts, editorial selection, and client trust.",
    scenarioExample:
      "A vendor sponsors a materials event, invites top designers, and sees 20 new projects created within a month featuring their products discovered at that event.",
  },
  "projects-atelier": {
    id: "projects-atelier",
    from: "projects",
    to: "atelier",
    label: "Projects train and power Atelier",
    description:
      "Folio Atelier learns from projects and also generates new outputs back into them. It's both a memory layer and a creative engine.",
    valueForDesigners:
      "Their real work trains their personal 'second brain,' so prompts yield outputs that sound like them, not generic AI. Atelier can draft editorials, moodboards, and specs directly from the projects, tags, and products they've already used.",
    valueForVendors:
      "Products that appear in highly tagged, successful projects end up being suggested more often in Atelier-generated content. Vendors don't have to write separate AI prompts – the system automatically learns from real designer usage.",
    scenarioExample:
      "After a designer has 10 well-tagged projects, Atelier can generate a new concept board using their favorite stone vendors and color palettes, with full specs and vendor credits already attached.",
  },
  "tags-atelier": {
    id: "tags-atelier",
    from: "tags",
    to: "atelier",
    label: "Tags train Atelier's understanding",
    description:
      "Folio Atelier learns from tags and also generates new outputs back into them. It's both a memory layer and a creative engine.",
    valueForDesigners:
      "Their real work trains their personal 'second brain,' so prompts yield outputs that sound like them, not generic AI. Atelier can draft editorials, moodboards, and specs directly from the projects, tags, and products they've already used.",
    valueForVendors:
      "Products that appear in highly tagged, successful projects end up being suggested more often in Atelier-generated content. Vendors don't have to write separate AI prompts – the system automatically learns from real designer usage.",
    scenarioExample:
      "After a designer has 10 well-tagged projects, Atelier can generate a new concept board using their favorite stone vendors and color palettes, with full specs and vendor credits already attached.",
  },
  "editorials-atelier": {
    id: "editorials-atelier",
    from: "editorials",
    to: "atelier",
    label: "Editorials train and power Atelier",
    description:
      "Folio Atelier learns from editorials and also generates new outputs back into them. It's both a memory layer and a creative engine.",
    valueForDesigners:
      "Their real work trains their personal 'second brain,' so prompts yield outputs that sound like them, not generic AI. Atelier can draft editorials, moodboards, and specs directly from the projects, tags, and products they've already used.",
    valueForVendors:
      "Products that appear in highly tagged, successful projects end up being suggested more often in Atelier-generated content. Vendors don't have to write separate AI prompts – the system automatically learns from real designer usage.",
    scenarioExample:
      "After a designer has 10 well-tagged projects, Atelier can generate a new concept board using their favorite stone vendors and color palettes, with full specs and vendor credits already attached.",
  },
  "vendors-atelier": {
    id: "vendors-atelier",
    from: "vendors",
    to: "atelier",
    label: "Vendors inform Atelier's product knowledge",
    description:
      "Folio Atelier learns from vendors and also generates new outputs back into them. It's both a memory layer and a creative engine.",
    valueForDesigners:
      "Their real work trains their personal 'second brain,' so prompts yield outputs that sound like them, not generic AI. Atelier can draft editorials, moodboards, and specs directly from the projects, tags, and products they've already used.",
    valueForVendors:
      "Products that appear in highly tagged, successful projects end up being suggested more often in Atelier-generated content. Vendors don't have to write separate AI prompts – the system automatically learns from real designer usage.",
    scenarioExample:
      "After a designer has 10 well-tagged projects, Atelier can generate a new concept board using their favorite stone vendors and color palettes, with full specs and vendor credits already attached.",
  },
};

