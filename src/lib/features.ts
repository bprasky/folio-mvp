import { getFeatureFlag } from './flags';

export const features = {
  vendorHandoff: getFeatureFlag('FEATURE_VENDOR_HANDOFF', false),
  vendorVisits: getFeatureFlag('FEATURE_VENDOR_VISITS', false),
  vendorQuotesVersions: getFeatureFlag('FEATURE_VENDOR_QUOTES_VERSIONS', false),
  vendorQuickActions: getFeatureFlag('FEATURE_VENDOR_QUICK_ACTIONS', false),
  vendorDashboardV2: getFeatureFlag('FEATURE_VENDOR_DASHBOARD_V2', false),
} as const;

export type Feature = keyof typeof features;
