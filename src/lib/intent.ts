import type { IntentDesigner } from "@/lib/mock/eventPost";

/**
 * Calculate intent score based on designer behavior and engagement
 * Score range: 0-100
 */
export function calculateIntentScore(designer: Omit<IntentDesigner, 'intentScore'>): number {
  const now = new Date();
  const lastEngaged = new Date(designer.lastEngagedAt);
  const daysSinceLastEngaged = Math.floor((now.getTime() - lastEngaged.getTime()) / (1000 * 60 * 60 * 24));
  
  // Base score components
  const savesScore = designer.saves * 3; // Each save = 3 points
  const tagsScore = designer.tags * 5;   // Each tag = 5 points (higher intent)
  const reopenedBoardsScore = designer.reopenedBoards * 4; // Each reopen = 4 points
  const movedPhaseScore = designer.movedPhase ? 12 : 0; // Phase progression = 12 points
  const priorPurchasesScore = designer.priorPurchases ? 15 : 0; // Prior relationship = 15 points
  
  // Time decay penalty (capped at 18 points)
  const timeDecay = Math.min(daysSinceLastEngaged * 1.2, 18);
  
  // Calculate final score, bounded between 0-100
  const rawScore = savesScore + tagsScore + reopenedBoardsScore + movedPhaseScore + priorPurchasesScore - timeDecay;
  
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Categorize designer into intent segment based on score
 */
export function getIntentSegment(intentScore: number): 'readyToClose' | 'warmEvaluators' | 'earlyExplorers' | 'cold' {
  if (intentScore >= 80) return 'readyToClose';
  if (intentScore >= 60) return 'warmEvaluators';
  if (intentScore >= 40) return 'earlyExplorers';
  return 'cold';
}

/**
 * Get recommended action for intent segment
 */
export function getRecommendedAction(segment: string): { action: string; description: string } {
  switch (segment) {
    case 'readyToClose':
      return {
        action: 'Close Offer 5%',
        description: 'High-intent designers ready for closing incentives'
      };
    case 'warmEvaluators':
      return {
        action: 'Send Sample Kit',
        description: 'Warm prospects evaluating specifications'
      };
    case 'earlyExplorers':
      return {
        action: 'Share Moodboard Images',
        description: 'Early-stage designers exploring concepts'
      };
    default:
      return {
        action: 'Follow Up',
        description: 'Continue nurturing relationship'
      };
  }
}









