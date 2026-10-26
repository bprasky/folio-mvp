/**
 * Explicit current visibility wins over historical publication timestamps.
 * Keep the OR shape for callers that compose these public alternatives.
 */
export const PUBLISHED_PROJECT_FILTER = { OR: [{ isPublic: true }] };
