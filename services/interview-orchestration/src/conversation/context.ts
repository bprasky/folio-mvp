import Anthropic from '@anthropic-ai/sdk';
import type { ConversationContext, ConversationExchange } from '../types.js';

/**
 * Manages conversation context for real-time interviews
 * Handles rolling summaries and extraction accumulation
 */
export class ContextManager {
  private context: ConversationContext;
  private anthropic: Anthropic;
  private maxRecentExchanges = 5;

  constructor(initialContext: ConversationContext, anthropic: Anthropic) {
    this.context = initialContext;
    this.anthropic = anthropic;
  }

  /**
   * Add a new exchange and update context
   */
  async addExchange(exchange: ConversationExchange): Promise<void> {
    this.context.recentExchanges.push(exchange);
    this.context.turnCount++;

    // Extract and accumulate insights
    if (exchange.extractions) {
      if (exchange.extractions.pullQuote) {
        this.context.extractedQuotes.push(exchange.extractions.pullQuote);
      }
      if (exchange.extractions.productMentions) {
        exchange.extractions.productMentions.forEach((p) => {
          this.context.extractedProducts.push({
            name: p.name,
            context: exchange.content.slice(0, 100),
          });
        });
      }
      if (
        exchange.extractions.theme &&
        !this.context.extractedThemes.includes(exchange.extractions.theme)
      ) {
        this.context.extractedThemes.push(exchange.extractions.theme);
      }
    }

    // Compress if needed to manage context window
    if (this.context.recentExchanges.length > this.maxRecentExchanges) {
      await this.compressOldestExchanges();
    }
  }

  /**
   * Compress old exchanges into the rolling summary
   */
  private async compressOldestExchanges(): Promise<void> {
    const toCompress = this.context.recentExchanges.splice(0, 2);

    const compressionPrompt = `Summarize these conversation exchanges into 2-3 sentences that preserve key information (decisions made, products discussed, themes mentioned):

${toCompress.map((e) => `${e.role.toUpperCase()}: ${e.content}`).join('\n\n')}

Current summary: ${this.context.summary || 'None yet'}

Return ONLY the updated summary, incorporating the new exchanges.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: compressionPrompt }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        this.context.summary = textContent.text;
      }
    } catch (error) {
      console.error('Failed to compress exchanges:', error);
      // Fallback: just concatenate summaries
      const fallbackSummary = toCompress
        .map((e) => `${e.role}: ${e.content.slice(0, 50)}...`)
        .join(' ');
      this.context.summary = this.context.summary
        ? `${this.context.summary} ${fallbackSummary}`
        : fallbackSummary;
    }
  }

  /**
   * Build project context string for Sofia's prompt
   */
  buildPromptContext(): { projectContext: string; designerContext: string } {
    const projectContext = `
PROJECT: ${this.context.projectName}
ROOMS: ${this.context.rooms.join(', ') || 'Not specified'}
IMAGES: ${this.context.images.length} photos across ${new Set(this.context.images.map((i) => i.roomName).filter(Boolean)).size} spaces
KEY PRODUCTS: ${this.context.products.slice(0, 10).map((p) => `${p.productName}${p.vendorName ? ` (${p.vendorName})` : ''}`).join(', ') || 'None tagged'}
VISUAL NOTES: ${this.context.images.slice(0, 5).map((i) => i.aiClassification ? `${i.roomName || 'Space'}: ${i.aiClassification.style || ''} ${i.aiClassification.mood || ''}`.trim() : null).filter(Boolean).join('; ') || 'None available'}`;

    const designerContext = `
NAME: ${this.context.designerName}
${this.context.designerBio ? `BACKGROUND: ${this.context.designerBio}` : ''}`;

    return { projectContext, designerContext };
  }

  /**
   * Build conversation context for continuation prompts
   */
  buildConversationContext(): string {
    const summary = this.context.summary
      ? `CONVERSATION SO FAR:\n${this.context.summary}\n\n`
      : '';

    const recent =
      this.context.recentExchanges.length > 0
        ? `RECENT EXCHANGES:\n${this.context.recentExchanges.map((e) => `${e.role.toUpperCase()}: ${e.content}`).join('\n\n')}`
        : '';

    const extractions = `
QUOTES CAPTURED: ${this.context.extractedQuotes.length}
PRODUCTS DISCUSSED: ${this.context.extractedProducts.map((p) => p.name).join(', ') || 'None yet'}
THEMES EMERGING: ${this.context.extractedThemes.join(', ') || 'None yet'}`;

    return `${summary}${recent}\n\n${extractions}`;
  }

  /**
   * Get the current context state
   */
  getContext(): ConversationContext {
    return this.context;
  }

  /**
   * Determine if we should start wrapping up
   */
  shouldWrapUp(): boolean {
    // Suggest wrapping up after ~10-15 meaningful exchanges
    // or if we've covered all rooms and have good quotes
    const hasEnoughQuotes = this.context.extractedQuotes.length >= 3;
    const hasEnoughTurns = this.context.turnCount >= 12;
    const hasGoodCoverage = this.context.extractedThemes.length >= 3;

    return hasEnoughTurns && (hasEnoughQuotes || hasGoodCoverage);
  }

  /**
   * Update turn count
   */
  incrementTurnCount(): void {
    this.context.turnCount++;
  }

  /**
   * Get summary for session completion
   */
  getSessionSummary(): {
    summary: string;
    quotes: string[];
    products: Array<{ name: string; context: string }>;
    themes: string[];
    turnCount: number;
  } {
    return {
      summary: this.context.summary,
      quotes: this.context.extractedQuotes,
      products: this.context.extractedProducts,
      themes: this.context.extractedThemes,
      turnCount: this.context.turnCount,
    };
  }
}
