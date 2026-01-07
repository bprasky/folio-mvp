// [Editorial Curator Integration] Editorial scoring + scheduling constants

export const EDITORIAL_SCORE_WEIGHTS = {
  engagement: 0.4,
  vendorDiversity: 0.2,
  styleUniqueness: 0.2,
  trendAlignment: 0.2,
} as const;

export const EDITORIAL_CURATOR_THRESHOLDS = {
  highScore: 0.75,
  clusterMinimum: 5,
  schedulerMinimum: 3,
  trendMomentumMin: 0.35,
  editionPublishScore: 0.75,
} as const;

export const EDITORIAL_CURATOR_CONSTANTS = {
  analyticsTable: "project_analytics",
  styleEmbeddingNodeType: "project_style_dna",
  editionSlugPrefix: "edition",
  notificationEvent: "editorial_edition_published",
} as const;

export const EDITORIAL_SCHEDULER_PROMPT = `
Generate an editorial title and 100-word intro summarizing the shared aesthetic of these projects:
- Category: {{category_labels}}
- Region: {{region_labels}}
- Themes: {{trend_keywords}}

Maintain Folio’s editorial tone: elegant, professional, timeless.
`.trim();


