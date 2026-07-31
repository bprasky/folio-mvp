/**
 * Designer Website Scraping
 *
 * Scrapes a designer's website to extract structured data for the bio interview.
 * Uses fetch + basic HTML parsing (no headless browser needed).
 */

import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { directFetch } from '@/lib/browserless/client';
import { classifyScrapeOutcome, isBlockedOutcome } from '@/lib/browserless/classify';
import { recordScrapeAttempt } from '@/lib/browserless/record';
import { MODELS } from '@/lib/ai/models';

export type ScrapedDesignerData = {
  name?: string;
  firmName?: string;
  location?: string;
  bio?: string;
  specialties?: string[];
  education?: string;
  yearsInPractice?: string;
  awards?: string[];
  press?: string[];
  philosophy?: string;
  rawText?: string;
};

/**
 * Scrape a designer's website and extract structured data using AI.
 */
export async function scrapeDesignerWebsite(url: string): Promise<ScrapedDesignerData> {
  // Fetch the website HTML through the shared client (plain-fetch consumer for
  // now; Phase 1 adds challenge-page detection on this path).
  const response = await directFetch(url, {
    timeoutMs: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  const outcome = classifyScrapeOutcome(response);
  await recordScrapeAttempt({ url, consumer: 'DESIGNER_BIO', result: response, outcome });

  // A 200-status challenge page would otherwise be handed to Claude as if it
  // were real bio content. Stop it here once the classifier flags a block.
  if (isBlockedOutcome(outcome)) {
    throw new Error(
      'This website blocked automated access, so its content could not be read. Try a different page or enter your details manually.',
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch website: HTTP ${response.status}`);
  }

  const html = response.payload;

  // Extract text content from HTML (basic approach)
  const textContent = extractTextFromHTML(html);

  if (!textContent || textContent.length < 50) {
    throw new Error('Could not extract meaningful content from the website');
  }

  // Use AI to structure the extracted text
  return extractStructuredData(textContent, url);
}

/**
 * Basic HTML to text extraction.
 * Strips tags, scripts, styles, and normalizes whitespace.
 */
function extractTextFromHTML(html: string): string {
  let text = html;

  // Remove script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|h[1-6]|li|br|hr)[^>]*>/gi, '\n');

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Truncate if extremely long
  if (text.length > 10000) {
    text = text.substring(0, 10000);
  }

  return text;
}

/**
 * Use AI to extract structured profile data from raw website text.
 */
async function extractStructuredData(
  text: string,
  url: string
): Promise<ScrapedDesignerData> {
  const anthropic = new Anthropic();

  const result = await callLLM(
    async () => {
      const message = await anthropic.messages.create({
        model: MODELS.sonnet,
        thinking: { type: 'disabled' },
        system: `You are extracting structured profile data from a design professional's website. Extract whatever information is available. If a field isn't found, omit it.

Return JSON with these optional fields:
{
  "name": "Full name",
  "firmName": "Company/firm name",
  "location": "City, State or region",
  "bio": "Any existing bio or about text",
  "specialties": ["residential", "commercial", etc.],
  "education": "Education background",
  "yearsInPractice": "Years or founding year",
  "awards": ["Award 1", "Award 2"],
  "press": ["Publication 1", "Publication 2"],
  "philosophy": "Any stated design philosophy or approach"
}

Only include fields you can confidently extract. Do not make up information.`,
        messages: [
          {
            role: 'user',
            content: `Website URL: ${url}\n\nExtracted text content:\n${text}`,
          },
        ],
        max_tokens: 1000,
      });

      const content = message.content[0]?.type === 'text' ? message.content[0].text : null;
      if (!content) throw new Error('No content in response');
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    },
    {
      modelName: MODELS.sonnet,
      maxRetries: 2,
      contextHint: 'designer_website_scrape',
    }
  );

  if (!result.ok) {
    console.error('[extractStructuredData] Failed:', result.code);
    // Return minimal data with raw text so the interview can still proceed
    return { rawText: text.substring(0, 2000) };
  }

  return { ...result.data, rawText: text.substring(0, 2000) };
}
