// [Edition System] Export all edition generation functions

export { generateWeeklyEdition } from "./generateWeeklyEdition";
export { generateMonthlyEdition } from "./generateMonthlyEdition";
export { generateQuarterlyEdition } from "./generateQuarterlyEdition";
export { generateAnnualEdition } from "./generateAnnualEdition";
export {
  generateEditionCopy,
  generateEditionSlug,
  getBadgeLabel,
  type EditionCopy,
  type EditionCopyPayload,
} from "./generateEditionCopy";
