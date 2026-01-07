export type FolioActionCategory =
  | "events"
  | "products"
  | "designers"
  | "editorial"
  | "analytics";

export interface FolioVendorAction {
  id: string;
  category: FolioActionCategory;
  label: string;
  description: string;
  exampleUsage?: string;
}

export const folioVendorActions: FolioVendorAction[] = [
  // EVENTS
  {
    id: "boost_event_projects",
    category: "events",
    label: "Boost event-driven projects",
    description:
      "Increase visibility of projects that originated from a specific event across Folio's feed and discovery surfaces.",
  },
  {
    id: "create_event_recap_highlight",
    category: "events",
    label: "Create an event recap highlight",
    description:
      "Assemble a recap block showcasing top products, designers, and projects tied to an event for the vendor dashboard, vendor profile, or editorial pitches.",
  },
  {
    id: "create_event_guest_list",
    category: "events",
    label: "Create a designer guest list",
    description:
      "Generate a targeted list of designers for a future event based on engagement, style fit, and project value.",
  },
  {
    id: "create_appreciation_dinner",
    category: "events",
    label: "Create guest list for appreciation dinner",
    description:
      "Generates a 12–18 person ultra-high-ROI appreciation dinner with guests, reasoning, venue, budget, and projected unlock",
  },
  {
    id: "create_discovery_lunch",
    category: "events",
    label: "Create Discovery Lunch for High-Potential Designers",
    description:
      "Generates a $4–8k educational lunch for local designers who love similar products but have never engaged with yours",
  },
  {
    id: "monitor_event_roi",
    category: "events",
    label: "Monitor ROI for this event",
    description:
      "Track key indicators like influenced pipeline, saves, and tags for one or more events over time and flag changes.",
  },

  // PRODUCTS
  {
    id: "boost_product_feature",
    category: "products",
    label: "Boost these SKUs in discovery",
    description:
      "Give selected products additional placement across discovery surfaces such as search, related products, and boards.",
  },
  {
    id: "create_product_focus_board",
    category: "products",
    label: "Create a product focus board",
    description:
      "Group selected SKUs into a curated board that can be shared with designers, used in events, or referenced in editorial.",
  },
  {
    id: "monitor_low_performing_skus",
    category: "products",
    label: "Monitor low-performing SKUs",
    description:
      "Track products with weak engagement and flag if they remain underperforming or begin to recover.",
  },
  {
    id: "track_new_launch_response",
    category: "products",
    label: "Track new launch response",
    description:
      "Watch early engagement on a new collection to understand which SKUs are resonating before committing more spend.",
  },

  // DESIGNERS
  {
    id: "target_high_value_designers",
    category: "designers",
    label: "Target high-value designers",
    description:
      "Identify designers with strong alignment and high project budgets so vendors can prioritize relationship-building.",
  },
  {
    id: "create_retention_segment",
    category: "designers",
    label: "Create a retention segment",
    description:
      "Save a segment of designers whose engagement is cooling so the vendor can target them with follow-ups or invitations.",
  },
  {
    id: "send_designer_highlight_list",
    category: "designers",
    label: "Send a highlight list to designers",
    description:
      "Generate a product or board recommendation tailored to a specific designer segment (e.g., hospitality-focused, high-budget).",
  },
  {
    id: "identify_collab_candidates",
    category: "designers",
    label: "Identify collaboration candidates",
    description:
      "Suggest designers whose projects and behavior make them strong candidates for deeper collaboration or ambassador roles.",
  },

  // EDITORIAL / FEED
  {
    id: "boost_project_feature",
    category: "editorial",
    label: "Boost this project in the feed",
    description:
      "Increase the prominence of a project that uses the vendor's products in Folio's editorial-style feed.",
  },
  {
    id: "feature_on_vendor_profile",
    category: "editorial",
    label: "Feature this on my profile",
    description:
      "Pin or spotlight a project, collection, or board on the vendor's Folio profile hero area.",
  },
  {
    id: "recommend_editorial_pitch",
    category: "editorial",
    label: "Prepare an editorial pitch",
    description:
      "Recommend a project and angle that could be submitted to Folio's editorial team for deeper coverage.",
  },

  // ANALYTICS
  {
    id: "export_event_performance_report",
    category: "analytics",
    label: "Export event performance report",
    description:
      "Generate a structured summary of how specific events performed across views, saves, tags, and influenced pipeline.",
  },
  {
    id: "export_product_cohort_report",
    category: "analytics",
    label: "Export product cohort report",
    description:
      "Create a report that groups products into cohorts such as top performers, emerging, and at-risk SKUs.",
  },
  {
    id: "save_designer_segment",
    category: "analytics",
    label: "Save this designer segment",
    description:
      "Save a defined group of designers (e.g., top engaged in NYC) as a reusable segment for ongoing tracking.",
  },
  {
    id: "create_early_demand_watchlist",
    category: "analytics",
    label: "Create an early demand watchlist",
    description:
      "Track products that show early signs of traction so vendors can monitor demand before scaling production or spend.",
  },
];

