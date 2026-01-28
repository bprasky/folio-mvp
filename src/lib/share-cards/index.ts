/**
 * Share Cards
 * Generate shareable quote images for contributions
 */

export * from './types';
export {
  generateShareCard,
  generateAllVariants,
  getShareCards,
  trackShareEvent,
} from './generate';
export { generateShareCardSvg, truncateQuote } from './templates';
