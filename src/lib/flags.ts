export const flags = {
  /** Gate the glass landing rail for quick enable/disable */
  glassLandingRail: true,
  /** Enable new vendor dashboard with dual-tab structure and event→project bridge */
  vendorNewDashboard: process.env.NEXT_PUBLIC_FLAG_VENDOR_NEW_DASHBOARD === '1',
  /** Enable AI insights panels in vendor dashboard */
  vendorAIInsights: process.env.NEXT_PUBLIC_FLAG_VENDOR_AI_INSIGHTS === '1',
  /** Enable demo data for investor runs - fills all panels with realistic values */
  vendorDemoData: process.env.NEXT_PUBLIC_FLAG_VENDOR_DEMO_DATA === '1',
} as const;
