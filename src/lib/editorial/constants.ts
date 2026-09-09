// Edition scheduling constants. Classification is not a review state.

export const EDITORIAL_CURATOR_THRESHOLDS = {
  schedulerMinimum: 3,
  editionPublishScore: 0.75,
} as const;

export const EDITORIAL_CURATOR_CONSTANTS = {
  notificationEvent: "editorial_edition_published",
} as const;

export const EDITORIAL_SCHEDULER_PROMPT = `
Generate an editorial title and 100-word intro summarizing the shared aesthetic of these projects:
- Category: {{category_labels}}
- Region: {{region_labels}}
- Themes: {{trend_keywords}}

Maintain Folio’s editorial tone: elegant, professional, timeless.
`.trim();


