/**
 * Answer Digestion — Fast Heuristic Scoring
 *
 * Runs synchronously on every interview answer to extract intelligence signals:
 * - Richness scoring (is this answer thin, medium, or rich?)
 * - Vendor sentiment detection (positive mentions → boost potential)
 * - Design philosophy extraction (belief statements → Atelier fingerprint)
 * - Question effectiveness (did this question produce a good answer?)
 * - Thread detection (hints at untold stories worth following up)
 *
 * This is the heuristic layer — no LLM calls, runs in <1ms.
 * For deep AI analysis (pull quotes, boost eligibility), see answerAnalysis.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnswerDigest {
  /** 0-1 composite richness score */
  richnessScore: number;
  /** True when richnessScore < 0.3 */
  isThin: boolean;
  /** Reason the answer is thin (only set when isThin) */
  thinReason?: 'too_short' | 'generic' | 'yes_no';
  /** Detected vendor mentions with sentiment */
  vendorSentiments: VendorSentimentSignal[];
  /** Extracted design philosophy statements */
  philosophySignals: string[];
  /** How effective this question was at eliciting a rich answer */
  questionEffectiveness: 'high' | 'medium' | 'low';
  /** Whether the answer hints at an untold story worth following up */
  hasStoryThread: boolean;
  /** Detected specificity markers (proper nouns, numbers, room/product refs) */
  specificityScore: number;
}

export interface VendorSentimentSignal {
  vendorName: string;
  sentiment: 'positive' | 'neutral';
  /** The phrase surrounding the vendor mention */
  phrase: string;
  /** Whether this mention could be amplified for vendor boost */
  boostEligible: boolean;
}

export interface DigestContext {
  /** Vendor names known from the question or project context */
  knownVendors?: string[];
  /** Product names known from the question or project context */
  knownProducts?: string[];
  /** Room names from the project */
  knownRooms?: string[];
  /** The question text that prompted this answer */
  questionText?: string;
  /** The question type for effectiveness tracking */
  questionType?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const POSITIVE_VENDOR_INDICATORS = [
  'love', 'adore', 'trust', 'always', 'go-to', 'goto', 'go to',
  'come back', 'came back', 'keep coming back', 'loyal', 'favorite',
  'favourite', 'best', 'incredible', 'amazing', 'exceptional',
  'perfect', 'beautiful', 'stunning', 'exquisite', 'flawless',
  'quality', 'craftsmanship', 'artisan', 'relationship',
  'partner', 'collaborate', 'recommend', 'specify',
];

const PHILOSOPHY_PATTERNS = [
  /i (?:always |firmly |truly |really )?believe\b/i,
  /(?:my|our) (?:philosophy|approach|principle|belief|mantra) (?:is|has always been)/i,
  /i (?:always|never) (?:start|begin|approach|think about|consider)/i,
  /(?:for me|to me),?\s+(?:design|lighting|color|space|material|texture|comfort)/i,
  /(?:the most important|what matters most|the key|the secret) (?:thing |element |part |is |to me)/i,
  /i think (?:design|every|good|great|the best|a room|a space|a home)/i,
  /i['']ve (?:always|learned|come to believe|found that)/i,
  /(?:design|architecture|interiors?) (?:is|should be|must be) (?:about|always)/i,
];

const STORY_THREAD_PATTERNS = [
  /actually,?\s/i,
  /what happened was/i,
  /the (?:funny|interesting|surprising) (?:thing|part) (?:is|was)/i,
  /i (?:originally|initially) (?:wanted|planned|thought|envisioned)/i,
  /we (?:almost|nearly) (?:went|chose|did|used)/i,
  /(?:it|that) (?:wasn['']t|wasn't) (?:the |what |our )?(?:original|first|initial)/i,
  /there['']s (?:a|an) (?:story|reason|history) (?:behind|about)/i,
  /(?:long story|it['']s a story|funny story)/i,
  /(?:we|i) (?:discovered|stumbled|found|came across) (?:this|that|them|it)/i,
];

const YES_NO_STARTERS = [
  /^(?:yes|yeah|yep|yup|absolutely|definitely|totally|sure|of course)[,.\s!]/i,
  /^(?:no|nope|nah|not really|not exactly|not quite)[,.\s!]/i,
  /^(?:hmm|um|well)[,.\s]/i,
];

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Digest an interview answer into intelligence signals.
 * Pure heuristics — no LLM calls, runs synchronously in <1ms.
 */
export function digestInterviewAnswer(
  answerText: string,
  context?: DigestContext,
): AnswerDigest {
  const text = (answerText || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lowerText = text.toLowerCase();

  // ── Word count scoring ─────────────────────────────────────────────────
  let wordCountScore: number;
  if (wordCount < 10) wordCountScore = 0.05;
  else if (wordCount < 20) wordCountScore = 0.15;
  else if (wordCount < 50) wordCountScore = 0.35;
  else if (wordCount < 100) wordCountScore = 0.55;
  else if (wordCount < 150) wordCountScore = 0.75;
  else wordCountScore = 0.9;

  // ── Specificity scoring ────────────────────────────────────────────────
  let specificityScore = 0;
  let specificityHits = 0;

  // Numbers (measurements, quantities, years, prices)
  const numberMatches = text.match(/\b\d+(?:[',]\d{3})*(?:\.\d+)?\b/g);
  if (numberMatches && numberMatches.length > 0) {
    specificityHits += Math.min(numberMatches.length, 3);
  }

  // Known vendor names
  if (context?.knownVendors) {
    for (const vendor of context.knownVendors) {
      if (vendor && lowerText.includes(vendor.toLowerCase())) {
        specificityHits += 2;
      }
    }
  }

  // Known product names
  if (context?.knownProducts) {
    for (const product of context.knownProducts) {
      if (product && lowerText.includes(product.toLowerCase())) {
        specificityHits += 2;
      }
    }
  }

  // Known room names
  if (context?.knownRooms) {
    for (const room of context.knownRooms) {
      if (room && lowerText.includes(room.toLowerCase())) {
        specificityHits += 1;
      }
    }
  }

  // Proper noun detection (capitalized words mid-sentence)
  const properNouns = text.match(/(?<=\s)[A-Z][a-z]{2,}/g);
  if (properNouns && properNouns.length > 0) {
    specificityHits += Math.min(properNouns.length, 3);
  }

  // Material-specific terms
  const materialTerms = [
    'marble', 'granite', 'quartzite', 'limestone', 'travertine',
    'brass', 'bronze', 'nickel', 'chrome', 'copper',
    'oak', 'walnut', 'teak', 'mahogany', 'cedar',
    'linen', 'velvet', 'silk', 'wool', 'cashmere', 'leather',
    'concrete', 'steel', 'terracotta', 'plaster', 'porcelain',
  ];
  for (const term of materialTerms) {
    if (lowerText.includes(term)) {
      specificityHits += 1;
    }
  }

  specificityScore = Math.min(1, specificityHits / 8);

  // ── Philosophy detection ───────────────────────────────────────────────
  const philosophySignals: string[] = [];

  for (const pattern of PHILOSOPHY_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      // Extract the sentence containing the philosophy signal
      const sentenceStart = text.lastIndexOf('.', match.index);
      const sentenceEnd = text.indexOf('.', match.index + match[0].length);
      const sentence = text
        .slice(
          sentenceStart >= 0 ? sentenceStart + 1 : 0,
          sentenceEnd >= 0 ? sentenceEnd + 1 : undefined,
        )
        .trim();

      if (sentence.length > 15 && sentence.length < 300) {
        philosophySignals.push(sentence);
      }
    }
  }

  // ── Vendor sentiment detection ─────────────────────────────────────────
  const vendorSentiments: VendorSentimentSignal[] = [];

  if (context?.knownVendors) {
    for (const vendor of context.knownVendors) {
      if (!vendor) continue;
      const vendorLower = vendor.toLowerCase();
      const idx = lowerText.indexOf(vendorLower);
      if (idx === -1) continue;

      // Extract surrounding context (±60 chars)
      const start = Math.max(0, idx - 60);
      const end = Math.min(text.length, idx + vendor.length + 60);
      const surrounding = text.slice(start, end);
      const surroundingLower = surrounding.toLowerCase();

      // Check for positive indicators near the vendor mention
      const isPositive = POSITIVE_VENDOR_INDICATORS.some(
        (indicator) => surroundingLower.includes(indicator),
      );

      vendorSentiments.push({
        vendorName: vendor,
        sentiment: isPositive ? 'positive' : 'neutral',
        phrase: surrounding.trim(),
        boostEligible: isPositive && wordCount >= 30,
      });
    }
  }

  // ── Story thread detection ─────────────────────────────────────────────
  const hasStoryThread = STORY_THREAD_PATTERNS.some((pattern) => pattern.test(text));

  // ── Thin answer detection ──────────────────────────────────────────────
  let thinReason: 'too_short' | 'generic' | 'yes_no' | undefined;

  // Yes/no detection
  const isYesNo = wordCount < 30 && YES_NO_STARTERS.some((p) => p.test(text));
  if (isYesNo) thinReason = 'yes_no';
  else if (wordCount < 15) thinReason = 'too_short';
  else if (wordCount < 30 && specificityScore < 0.15) thinReason = 'generic';

  // ── Narrative quality bonus ────────────────────────────────────────────
  // Sentences that tell stories (first person narrative, temporal markers)
  let narrativeBonus = 0;
  const narrativeMarkers = [
    /\b(?:when|after|before|during|once|while)\b/i,
    /\b(?:decided|realized|discovered|noticed|knew|felt)\b/i,
    /\b(?:because|since|so that|in order to)\b/i,
    /\b(?:first|then|finally|eventually|ultimately)\b/i,
  ];
  for (const marker of narrativeMarkers) {
    if (marker.test(text)) narrativeBonus += 0.05;
  }
  narrativeBonus = Math.min(narrativeBonus, 0.15);

  // ── Composite richness score ───────────────────────────────────────────
  const richnessScore = Math.min(
    1,
    wordCountScore * 0.4 +
      specificityScore * 0.3 +
      (philosophySignals.length > 0 ? 0.15 : 0) +
      narrativeBonus +
      (vendorSentiments.some((v) => v.sentiment === 'positive') ? 0.05 : 0),
  );

  const isThin = richnessScore < 0.3;

  // ── Question effectiveness ─────────────────────────────────────────────
  let questionEffectiveness: 'high' | 'medium' | 'low';
  if (richnessScore >= 0.6) questionEffectiveness = 'high';
  else if (richnessScore >= 0.3) questionEffectiveness = 'medium';
  else questionEffectiveness = 'low';

  return {
    richnessScore: Math.round(richnessScore * 100) / 100,
    isThin,
    thinReason: isThin ? thinReason : undefined,
    vendorSentiments,
    philosophySignals,
    questionEffectiveness,
    hasStoryThread,
    specificityScore: Math.round(specificityScore * 100) / 100,
  };
}

/**
 * Build DigestContext from question metadata and project data.
 * Convenience helper for callers who have interview question data.
 */
export function buildDigestContext(opts: {
  questionText?: string;
  questionType?: string;
  vendors?: string[];
  products?: string[];
  rooms?: string[];
}): DigestContext {
  return {
    questionText: opts.questionText,
    questionType: opts.questionType,
    knownVendors: opts.vendors?.filter(Boolean),
    knownProducts: opts.products?.filter(Boolean),
    knownRooms: opts.rooms?.filter(Boolean),
  };
}
