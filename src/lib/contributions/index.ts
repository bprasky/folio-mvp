/**
 * Contributor/Voice System
 *
 * Enables designers, vendor reps, and individual users to contribute
 * their perspectives to upcoming articles.
 *
 * Flow:
 * 1. Admin creates ArticleTopic with prompt question
 * 2. Topic moves to GATHERING status
 * 3. Users see contribution prompts at various locations
 * 4. Users submit Contributions (text or voice)
 * 5. When threshold met, topic moves to WRITING
 * 6. Admin curates and publishes article
 * 7. Contributors get notified and earn badges
 */

// Types
export * from './types';

// Submission
export {
  submitContribution,
  getUserContribution,
  getUserContributions,
  updateContributionStatus,
} from './submit';

// Targeting
export {
  getTopicsForUser,
  matchUserToTopic,
  getForYouTopics,
} from './targeting';

// Prompts
export {
  getPromptsForLocation,
  recordImpression,
  recordImpressions,
  createDefaultPrompt,
  deactivateTopicPrompts,
} from './prompts';

// Badges
export {
  checkAndAwardBadges,
  getHighestBadgeLevel,
  getBadgeForRole,
  getContributorProfile,
  getNextBadgeLevel,
} from './badges';
