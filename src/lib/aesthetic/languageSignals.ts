import { LanguageSignals } from './types';

const TECHNICAL_TERMS = new Set([
  'specification', 'spec', 'dimension', 'measurement', 'technical',
  'structural', 'engineering', 'system', 'component', 'installation',
  'code', 'compliance', 'standard', 'protocol', 'methodology'
]);

const POETIC_TERMS = new Set([
  'flow', 'essence', 'soul', 'journey', 'narrative', 'story',
  'emotion', 'feeling', 'atmosphere', 'mood', 'spirit',
  'harmony', 'balance', 'rhythm', 'cadence', 'breath'
]);

const FORMAL_TERMS = new Set([
  'distinguished', 'sophisticated', 'elegant', 'refined',
  'prestigious', 'exclusive', 'luxurious', 'premium',
  'curated', 'bespoke', 'custom', 'artisanal'
]);

const RESTRAINED_INDICATORS = new Set([
  'minimal', 'simple', 'clean', 'quiet', 'subtle', 'understated',
  'restrained', 'refined', 'elegant', 'sophisticated'
]);

const WARM_INDICATORS = new Set([
  'warm', 'cozy', 'inviting', 'welcoming', 'comfortable',
  'homey', 'intimate', 'nurturing', 'soft', 'gentle'
]);

const DRAMATIC_INDICATORS = new Set([
  'dramatic', 'bold', 'striking', 'powerful', 'intense',
  'vibrant', 'energetic', 'dynamic', 'expressive', 'confident'
]);

const PLAYFUL_INDICATORS = new Set([
  'playful', 'fun', 'whimsical', 'lighthearted', 'cheerful',
  'bright', 'colorful', 'energetic', 'lively', 'vibrant'
]);

/**
 * Extract language signals from interview transcripts and project descriptions
 */
export function extractLanguageSignals(
  interviews: Array<{ transcript?: string }>,
  descriptions: string[]
): LanguageSignals {
  const allText = [
    ...interviews.map(i => i.transcript || '').filter(Boolean),
    ...descriptions.filter(Boolean)
  ].join(' ').toLowerCase();
  
  if (!allText.trim()) {
    return {
      vocabularyStyle: 'casual',
      emotionalTone: 'warm',
      keyPhrases: [],
    };
  }
  
  // Determine vocabulary style
  let technicalScore = 0;
  let poeticScore = 0;
  let formalScore = 0;
  
  const words = allText.split(/\s+/);
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^\w]/g, '');
    if (TECHNICAL_TERMS.has(normalized)) technicalScore++;
    if (POETIC_TERMS.has(normalized)) poeticScore++;
    if (FORMAL_TERMS.has(normalized)) formalScore++;
  }
  
  let vocabularyStyle: "technical" | "poetic" | "casual" | "formal";
  if (technicalScore > poeticScore && technicalScore > formalScore) {
    vocabularyStyle = 'technical';
  } else if (poeticScore > technicalScore && poeticScore > formalScore) {
    vocabularyStyle = 'poetic';
  } else if (formalScore > technicalScore && formalScore > poeticScore) {
    vocabularyStyle = 'formal';
  } else {
    vocabularyStyle = 'casual';
  }
  
  // Determine emotional tone
  let restrainedScore = 0;
  let warmScore = 0;
  let dramaticScore = 0;
  let playfulScore = 0;
  
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^\w]/g, '');
    if (RESTRAINED_INDICATORS.has(normalized)) restrainedScore++;
    if (WARM_INDICATORS.has(normalized)) warmScore++;
    if (DRAMATIC_INDICATORS.has(normalized)) dramaticScore++;
    if (PLAYFUL_INDICATORS.has(normalized)) playfulScore++;
  }
  
  let emotionalTone: "restrained" | "warm" | "dramatic" | "playful";
  const maxScore = Math.max(restrainedScore, warmScore, dramaticScore, playfulScore);
  if (maxScore === 0) {
    emotionalTone = 'warm'; // Default
  } else if (restrainedScore === maxScore) {
    emotionalTone = 'restrained';
  } else if (warmScore === maxScore) {
    emotionalTone = 'warm';
  } else if (dramaticScore === maxScore) {
    emotionalTone = 'dramatic';
  } else {
    emotionalTone = 'playful';
  }
  
  // Extract key phrases (simple: 2-3 word sequences that appear multiple times)
  const phraseCounts: Record<string, number> = {};
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ');
    phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
  }
  
  const keyPhrases = Object.entries(phraseCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
  
  return {
    vocabularyStyle,
    emotionalTone,
    keyPhrases,
  };
}


