/**
 * Answer Analysis for Boost Eligibility Detection
 *
 * Analyzes interview answers to detect:
 * - Vendor mentions with positive sentiment
 * - Quotable content for editorial pull quotes
 * - Boost eligibility for vendor promotion
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedQuestion } from './generateQuestions';

const anthropic = new Anthropic();

/**
 * Check if Anthropic API is enabled and available
 */
function isAnthropicEnabled(): boolean {
  return (
    process.env.ANTHROPIC_ENABLED === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface VendorSentiment {
  vendor: string;
  sentiment: Sentiment;
  confidence: number;
}

export interface AnswerAnalysis {
  // Entities detected
  vendors_mentioned: string[];
  products_mentioned: string[];

  // Sentiment analysis
  overall_sentiment: Sentiment;
  vendor_sentiments: VendorSentiment[];

  // Editorial potential
  quotable: boolean;
  suggested_pull_quote?: string;

  // Boost eligibility
  boost_eligible: boolean;
  boost_vendors?: string[]; // Vendors that could boost this answer

  // Additional insights
  themes: string[];
  emotional_tone?: string;
}

/**
 * Analyze an interview answer for boost eligibility and quotability
 */
export async function analyzeAnswer(
  question: GeneratedQuestion,
  answer: string
): Promise<AnswerAnalysis> {
  // First, do basic analysis without AI
  const basicAnalysis = performBasicAnalysis(question, answer);

  // If AI is not available, return basic analysis
  if (!isAnthropicEnabled()) {
    return basicAnalysis;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Analyze this interview answer:

Question: "${question.text}"
Answer: "${answer}"

Known vendors from question context: ${question.vendors?.join(', ') || 'None'}
Known products from question context: ${question.products?.join(', ') || 'None'}

Return JSON only:
{
  "overall_sentiment": "positive" | "neutral" | "negative",
  "quotable": boolean (is this a strong, publishable quote?),
  "suggested_pull_quote": string | null (if quotable, extract the best 1-2 sentences),
  "vendor_sentiments": [{"vendor": "Name", "sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0}],
  "themes": string[] (key themes in the answer: "craftsmanship", "collaboration", etc.),
  "emotional_tone": string (e.g., "proud", "grateful", "reflective")
}

Focus on detecting positive vendor mentions that could be used for promotional content.
Return ONLY valid JSON, no other text.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return basicAnalysis;
    }

    // Parse AI response
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const aiAnalysis = JSON.parse(jsonText) as {
      overall_sentiment: Sentiment;
      quotable: boolean;
      suggested_pull_quote?: string;
      vendor_sentiments: VendorSentiment[];
      themes: string[];
      emotional_tone?: string;
    };

    // Merge AI analysis with basic analysis
    const vendorsMentioned = [
      ...new Set([...basicAnalysis.vendors_mentioned, ...aiAnalysis.vendor_sentiments.map((v) => v.vendor)]),
    ];

    // Determine boost eligibility
    const positiveVendors = aiAnalysis.vendor_sentiments
      .filter((v) => v.sentiment === 'positive' && v.confidence >= 0.7)
      .map((v) => v.vendor);

    const boostEligible =
      aiAnalysis.quotable && positiveVendors.length > 0 && aiAnalysis.overall_sentiment === 'positive';

    return {
      vendors_mentioned: vendorsMentioned,
      products_mentioned: basicAnalysis.products_mentioned,
      overall_sentiment: aiAnalysis.overall_sentiment,
      vendor_sentiments: aiAnalysis.vendor_sentiments,
      quotable: aiAnalysis.quotable,
      suggested_pull_quote: aiAnalysis.suggested_pull_quote,
      boost_eligible: boostEligible,
      boost_vendors: boostEligible ? positiveVendors : undefined,
      themes: aiAnalysis.themes,
      emotional_tone: aiAnalysis.emotional_tone,
    };
  } catch (error) {
    console.error('[answerAnalysis] Failed to analyze answer with AI:', error);
    return basicAnalysis;
  }
}

/**
 * Perform basic analysis without AI
 */
function performBasicAnalysis(question: GeneratedQuestion, answer: string): AnswerAnalysis {
  const lowerAnswer = answer.toLowerCase();

  // Detect vendors mentioned in the answer
  const vendorsMentioned: string[] = [];
  if (question.vendors) {
    for (const vendor of question.vendors) {
      if (lowerAnswer.includes(vendor.toLowerCase())) {
        vendorsMentioned.push(vendor);
      }
    }
  }

  // Basic sentiment detection based on positive words
  const positiveWords = [
    'love',
    'beautiful',
    'amazing',
    'wonderful',
    'perfect',
    'excellent',
    'fantastic',
    'incredible',
    'stunning',
    'gorgeous',
    'exceptional',
    'proud',
    'favorite',
    'best',
    'great',
    'thrilled',
    'delighted',
    'impressed',
    'quality',
    'craftsmanship',
  ];

  const negativeWords = ['difficult', 'challenging', 'problem', 'issue', 'struggle', 'frustrating', 'disappointed'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerAnswer.includes(word)) {
      positiveCount++;
    }
  }

  for (const word of negativeWords) {
    if (lowerAnswer.includes(word)) {
      negativeCount++;
    }
  }

  const overallSentiment: Sentiment =
    positiveCount > negativeCount * 2 ? 'positive' : negativeCount > positiveCount ? 'negative' : 'neutral';

  // Basic quotability check (answers with good length and positive sentiment)
  const wordCount = answer.split(/\s+/).length;
  const quotable = wordCount >= 20 && wordCount <= 200 && overallSentiment === 'positive';

  // Extract a potential pull quote (first or second sentence if it's good)
  let suggestedPullQuote: string | undefined;
  if (quotable) {
    const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    if (sentences.length > 0) {
      // Pick the sentence with the most positive words
      let bestSentence = sentences[0];
      let bestScore = 0;

      for (const sentence of sentences.slice(0, 3)) {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        for (const word of positiveWords) {
          if (sentenceLower.includes(word)) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestSentence = sentence;
        }
      }

      suggestedPullQuote = bestSentence.trim() + '.';
    }
  }

  // Basic boost eligibility
  const boostEligible = quotable && vendorsMentioned.length > 0 && overallSentiment === 'positive';

  return {
    vendors_mentioned: vendorsMentioned,
    products_mentioned: question.products || [],
    overall_sentiment: overallSentiment,
    vendor_sentiments: vendorsMentioned.map((vendor) => ({
      vendor,
      sentiment: overallSentiment,
      confidence: 0.5, // Low confidence for basic analysis
    })),
    quotable,
    suggested_pull_quote: suggestedPullQuote,
    boost_eligible: boostEligible,
    boost_vendors: boostEligible ? vendorsMentioned : undefined,
    themes: detectThemes(answer),
  };
}

/**
 * Detect themes in an answer using keyword matching
 */
function detectThemes(answer: string): string[] {
  const themes: string[] = [];
  const lowerAnswer = answer.toLowerCase();

  const themeKeywords: Record<string, string[]> = {
    craftsmanship: ['craft', 'craftsmanship', 'handmade', 'artisan', 'detail', 'quality', 'precision'],
    collaboration: ['collaborate', 'collaboration', 'team', 'together', 'partner', 'worked with'],
    sustainability: ['sustainable', 'eco', 'reclaimed', 'vintage', 'antique', 'recycled', 'natural'],
    light: ['light', 'lighting', 'bright', 'glow', 'illuminate', 'window', 'sun'],
    material: ['material', 'texture', 'fabric', 'stone', 'wood', 'metal', 'leather'],
    color: ['color', 'palette', 'tone', 'hue', 'warm', 'cool', 'neutral'],
    function: ['function', 'practical', 'livable', 'everyday', 'comfortable', 'useful'],
    client: ['client', 'homeowner', 'family', 'lifestyle', 'how they live'],
    journey: ['journey', 'process', 'evolution', 'story', 'developed', 'evolved'],
    vision: ['vision', 'concept', 'idea', 'dream', 'imagine', 'envisioned'],
  };

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    for (const keyword of keywords) {
      if (lowerAnswer.includes(keyword)) {
        themes.push(theme);
        break;
      }
    }
  }

  return themes;
}

/**
 * Batch analyze multiple answers
 */
export async function analyzeAnswers(
  questionsAndAnswers: Array<{ question: GeneratedQuestion; answer: string }>
): Promise<Map<string, AnswerAnalysis>> {
  const results = new Map<string, AnswerAnalysis>();

  // Process in parallel with a concurrency limit
  const concurrency = 3;
  for (let i = 0; i < questionsAndAnswers.length; i += concurrency) {
    const batch = questionsAndAnswers.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ question, answer }) => {
        const analysis = await analyzeAnswer(question, answer);
        return { questionId: question.id, analysis };
      })
    );

    for (const { questionId, analysis } of batchResults) {
      results.set(questionId, analysis);
    }
  }

  return results;
}

/**
 * Generate a boost summary for a set of analyzed answers
 */
export function generateBoostSummary(
  analyses: Map<string, AnswerAnalysis>
): {
  totalBoostable: number;
  boostableVendors: Map<string, number>;
  topPullQuotes: Array<{ vendor: string; quote: string }>;
} {
  let totalBoostable = 0;
  const boostableVendors = new Map<string, number>();
  const pullQuotes: Array<{ vendor: string; quote: string }> = [];

  for (const analysis of analyses.values()) {
    if (analysis.boost_eligible) {
      totalBoostable++;

      if (analysis.boost_vendors) {
        for (const vendor of analysis.boost_vendors) {
          boostableVendors.set(vendor, (boostableVendors.get(vendor) || 0) + 1);
        }

        // Collect pull quotes with vendor attribution
        if (analysis.suggested_pull_quote) {
          for (const vendor of analysis.boost_vendors) {
            pullQuotes.push({
              vendor,
              quote: analysis.suggested_pull_quote,
            });
          }
        }
      }
    }
  }

  // Get top pull quotes (one per vendor, highest sentiment)
  const seenVendors = new Set<string>();
  const topPullQuotes = pullQuotes.filter(({ vendor }) => {
    if (seenVendors.has(vendor)) return false;
    seenVendors.add(vendor);
    return true;
  });

  return {
    totalBoostable,
    boostableVendors,
    topPullQuotes: topPullQuotes.slice(0, 5),
  };
}

/**
 * Check if an answer is suitable for a vendor highlight
 */
export function isVendorHighlightWorthy(analysis: AnswerAnalysis, vendorName: string): boolean {
  // Check if the vendor was mentioned positively
  const vendorSentiment = analysis.vendor_sentiments.find(
    (v) => v.vendor.toLowerCase() === vendorName.toLowerCase()
  );

  if (!vendorSentiment) return false;

  return (
    vendorSentiment.sentiment === 'positive' &&
    vendorSentiment.confidence >= 0.7 &&
    analysis.quotable
  );
}

/**
 * Analyze an answer and create boost opportunities if eligible
 *
 * This is the main integration point for the boost system.
 * Call this after a designer submits an interview answer.
 */
export async function analyzeAndProcessAnswer(
  projectId: string,
  designerId: string,
  questionId: string,
  question: GeneratedQuestion,
  answer: string
): Promise<AnswerAnalysis> {
  // Run analysis
  const analysis = await analyzeAnswer(question, answer);

  // Create boost opportunities if eligible
  if (analysis.boost_eligible) {
    try {
      // Dynamically import to avoid circular dependencies
      const { createBoostOpportunities } = await import('@/lib/boost');

      await createBoostOpportunities({
        projectId,
        designerId,
        questionId,
        answer,
        analysis,
      });
    } catch (error) {
      console.error('[analyzeAndProcessAnswer] Failed to create boost opportunities:', error);
      // Don't fail the analysis if boost creation fails
    }
  }

  return analysis;
}
