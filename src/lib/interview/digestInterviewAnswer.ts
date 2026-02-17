/**
 * Answer Digestion — Fast heuristic scoring of interview answers.
 *
 * No LLM call. Runs synchronously. Extracts richness, vendor sentiment,
 * philosophy signals, product pairings, client management patterns, and
 * unpulled threads for adaptive follow-ups.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendorSentimentDigest {
  vendorName: string;
  sentiment: 'positive' | 'neutral';
  phrase: string;
  boostEligible: boolean;
}

export interface PairingSignal {
  products: string[];
  reasoning: string;
}

export interface VendorLoyaltySignal {
  vendorName: string;
  loyaltyPhrase: string;
}

export interface AnswerDigest {
  // Quality
  richnessScore: number; // 0-1 composite
  isThin: boolean; // richnessScore < 0.3
  thinReason?: 'too_short' | 'generic' | 'yes_no';

  // Vendor intelligence
  vendorSentiments: VendorSentimentDigest[];

  // Atelier signals (ordered by priority)
  philosophySignals: string[]; // 1st priority: detected belief statements
  pairingSignals: PairingSignal[]; // 2nd priority: product relationship reasoning
  vendorLoyaltySignals: VendorLoyaltySignal[]; // 3rd priority: repeat vendor patterns
  clientManagementSignals: string[]; // 4th priority: client guidance patterns

  // Meta
  questionEffectiveness: 'high' | 'medium' | 'low';
  hasUnpulledThread: boolean;
  threadHint?: string;
}

export interface QuestionContext {
  vendorNames?: string[];
  productNames?: string[];
  roomNames?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHILOSOPHY_KEYWORDS = [
  'i believe',
  'i always',
  'i never',
  'my philosophy',
  'my approach',
  'important to me',
  'i think design should',
  "for me it's about",
  "for me it\\'s about",
  "i'm drawn to",
  'what matters is',
];

const PAIRING_KEYWORDS = [
  'works with',
  'complements',
  'pairs with',
  'balances',
  'contrasts with',
  'echoes',
  'plays off',
  'grounds',
  'anchors',
  'softens',
];

const VENDOR_POSITIVE_KEYWORDS = [
  'love',
  'always come back',
  'go-to',
  'trust',
  'reliable',
  'relationship',
  'years',
  'favorite',
  'incredible',
  'beautiful quality',
  'never disappoints',
  'depend on',
];

const CLIENT_MANAGEMENT_KEYWORDS = [
  'the client',
  'they wanted',
  'i showed them',
  'i convinced',
  'we discussed',
  'i guided',
  'they trusted',
  'i recommended',
  'my client',
  'the homeowner',
];

const THREAD_MARKERS = [
  'actually',
  'what happened was',
  'the funny thing is',
  'i originally',
  'at first',
  'we almost',
  'the story behind',
  'it started when',
  'there was a moment',
];

const TEMPORAL_MARKERS = [
  'when',
  'first',
  'then',
  'eventually',
  'initially',
  'finally',
  'over time',
  'at that point',
];

const CAUSAL_MARKERS = [
  'because',
  'so that',
  'which meant',
  'in order to',
  'the reason',
  'that way',
  'as a result',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function findSentenceContaining(sentences: string[], keywords: string[]): string | undefined {
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      return sentence;
    }
  }
  return undefined;
}

function findAllSentencesContaining(sentences: string[], keywords: string[]): string[] {
  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });
}

// ---------------------------------------------------------------------------
// Core digestion
// ---------------------------------------------------------------------------

export function digestInterviewAnswer(
  answerText: string,
  questionContext?: QuestionContext
): AnswerDigest {
  const text = answerText.trim();
  const words = wordCount(text);
  const lower = text.toLowerCase();
  const sentences = splitSentences(text);
  const vendorNames = questionContext?.vendorNames ?? [];
  const productNames = questionContext?.productNames ?? [];

  // -----------------------------------------------------------------------
  // Richness scoring (composite 0-1)
  // -----------------------------------------------------------------------
  let richnessScore = 0;

  // Word count component
  if (words < 20) richnessScore = 0.1;
  else if (words < 50) richnessScore = 0.3;
  else if (words < 100) richnessScore = 0.5;
  else if (words < 150) richnessScore = 0.7;
  else richnessScore = 0.9;

  // Specificity bonus: proper nouns, product/vendor names, numbers, room names
  const hasSpecifics =
    vendorNames.some((v) => v && lower.includes(v.toLowerCase())) ||
    productNames.some((p) => p && lower.includes(p.toLowerCase())) ||
    (questionContext?.roomNames ?? []).some((r) => r && lower.includes(r.toLowerCase())) ||
    /\b\d+\b/.test(text) ||
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(text); // proper noun sequences

  if (hasSpecifics) {
    richnessScore = Math.min(1, richnessScore + 0.1);
  }

  // Narrative bonus: temporal or causal language
  if (containsAny(text, TEMPORAL_MARKERS) || containsAny(text, CAUSAL_MARKERS)) {
    richnessScore = Math.min(1, richnessScore + 0.1);
  }

  // Thin detection
  let isThin = richnessScore < 0.3;
  let thinReason: 'too_short' | 'generic' | 'yes_no' | undefined;

  if (isThin) {
    if (words < 10) {
      thinReason = 'too_short';
    } else if (/^(yes|no|yeah|nah|sure|definitely|absolutely)[.,!]?\s*$/i.test(text)) {
      thinReason = 'yes_no';
    } else {
      thinReason = 'generic';
    }
  }

  // -----------------------------------------------------------------------
  // Philosophy detection (1st priority)
  // -----------------------------------------------------------------------
  const philosophySignals = findAllSentencesContaining(sentences, PHILOSOPHY_KEYWORDS);

  // -----------------------------------------------------------------------
  // Product pairing detection (2nd priority)
  // -----------------------------------------------------------------------
  const pairingSignals: PairingSignal[] = [];
  const allProductMaterials = [
    ...productNames,
    ...(questionContext?.roomNames ?? []),
  ].filter(Boolean);

  if (allProductMaterials.length >= 2) {
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (PAIRING_KEYWORDS.some((kw) => lowerSentence.includes(kw))) {
        const mentioned = allProductMaterials.filter((p) =>
          lowerSentence.includes(p.toLowerCase())
        );
        if (mentioned.length >= 2) {
          pairingSignals.push({
            products: mentioned,
            reasoning: sentence,
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Vendor loyalty detection (3rd priority)
  // -----------------------------------------------------------------------
  const vendorLoyaltySignals: VendorLoyaltySignal[] = [];

  for (const vendor of vendorNames) {
    if (!vendor) continue;
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (
        lowerSentence.includes(vendor.toLowerCase()) &&
        VENDOR_POSITIVE_KEYWORDS.some((kw) => lowerSentence.includes(kw))
      ) {
        vendorLoyaltySignals.push({
          vendorName: vendor,
          loyaltyPhrase: sentence,
        });
        break; // one per vendor
      }
    }
  }

  // -----------------------------------------------------------------------
  // Vendor sentiment detection
  // -----------------------------------------------------------------------
  const vendorSentiments: VendorSentimentDigest[] = [];

  for (const vendor of vendorNames) {
    if (!vendor) continue;
    const vendorLower = vendor.toLowerCase();
    const mentionSentences = sentences.filter((s) =>
      s.toLowerCase().includes(vendorLower)
    );

    for (const sentence of mentionSentences) {
      const isPositive = VENDOR_POSITIVE_KEYWORDS.some((kw) =>
        sentence.toLowerCase().includes(kw)
      );
      const sentenceWords = wordCount(sentence);

      vendorSentiments.push({
        vendorName: vendor,
        sentiment: isPositive ? 'positive' : 'neutral',
        phrase: sentence,
        boostEligible: isPositive && sentenceWords > 10,
      });
      break; // one per vendor
    }
  }

  // -----------------------------------------------------------------------
  // Client management detection (4th priority)
  // -----------------------------------------------------------------------
  const clientManagementSignals = findAllSentencesContaining(
    sentences,
    CLIENT_MANAGEMENT_KEYWORDS
  );

  // -----------------------------------------------------------------------
  // Thread detection
  // -----------------------------------------------------------------------
  let hasUnpulledThread = false;
  let threadHint: string | undefined;

  const threadSentence = findSentenceContaining(sentences, THREAD_MARKERS);
  if (threadSentence) {
    // Only flag as thread if answer is short (story not fully told)
    // OR the marker is in the last sentence (answer ended abruptly)
    const isShort = words < 100;
    const isLastSentence =
      sentences.length > 0 &&
      sentences[sentences.length - 1] === threadSentence;

    if (isShort || isLastSentence) {
      hasUnpulledThread = true;
      threadHint = threadSentence;
    }
  }

  // -----------------------------------------------------------------------
  // Question effectiveness
  // -----------------------------------------------------------------------
  const questionEffectiveness: 'high' | 'medium' | 'low' =
    richnessScore > 0.6 ? 'high' : richnessScore >= 0.3 ? 'medium' : 'low';

  return {
    richnessScore,
    isThin,
    thinReason,
    vendorSentiments,
    philosophySignals,
    pairingSignals,
    vendorLoyaltySignals,
    clientManagementSignals,
    questionEffectiveness,
    hasUnpulledThread,
    threadHint,
  };
}
