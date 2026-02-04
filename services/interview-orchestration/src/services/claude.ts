import Anthropic from '@anthropic-ai/sdk';
import type { SofiaResponse } from '../types.js';

/**
 * Service for Claude AI interactions
 */
export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Get the Anthropic client for context management
   */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Generate a response from Sofia
   */
  async generateResponse(
    systemPrompt: string,
    userPrompt: string
  ): Promise<SofiaResponse> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || !('text' in textContent)) {
      throw new Error('No text response from Claude');
    }

    try {
      // Parse the JSON response
      const parsed = JSON.parse(textContent.text) as SofiaResponse;
      return {
        reply: parsed.reply || '',
        extractions: {
          pullQuote: parsed.extractions?.pullQuote || null,
          productMentions: parsed.extractions?.productMentions || [],
          theme: parsed.extractions?.theme || null,
          mood: parsed.extractions?.mood || null,
          roomFocus: parsed.extractions?.roomFocus || null,
        },
        nextQuestionIntent: parsed.nextQuestionIntent || '',
        shouldContinue: parsed.shouldContinue ?? true,
      };
    } catch {
      // If JSON parsing fails, treat the whole response as the reply
      console.warn('Failed to parse Sofia response as JSON, using raw text');
      return {
        reply: textContent.text,
        extractions: {
          pullQuote: null,
          productMentions: [],
          theme: null,
          mood: null,
          roomFocus: null,
        },
        nextQuestionIntent: '',
        shouldContinue: true,
      };
    }
  }

  /**
   * Generate opening with structured output
   */
  async generateOpening(
    systemPrompt: string,
    openingPrompt: string
  ): Promise<SofiaResponse> {
    return this.generateResponse(systemPrompt, openingPrompt);
  }

  /**
   * Generate closing with structured output
   */
  async generateClosing(
    systemPrompt: string,
    closingPrompt: string
  ): Promise<SofiaResponse> {
    return this.generateResponse(systemPrompt, closingPrompt);
  }
}
