import Anthropic from '@anthropic-ai/sdk';
import type { ConversationContext, ConversationExchange } from '../types.js';
import { MODELS } from '../models.js';

/**
 * Brief data loaded from ProjectPost.provenance.interviewBrief.
 * This is a subset of the full InterviewBrief type from the main app.
 */
interface NarrativeBriefData {
  visualImpression?: string;
  researchNotes?: string[];
  suggestedAngles?: string[];
  heroMoments?: Array<{
    description: string;
    roomName: string;
    relatedProducts: string[];
    whyNotable: string;
  }>;
  priorWorkConnections?: Array<{
    observation: string;
    currentDetail: string;
    priorDetail: string;
  }> | null;
}

interface BriefData {
  vendorMap?: Array<{
    name: string;
    productCount: number;
    rooms: string[];
    heroProducts: string[];
    isRepeatVendor: boolean;
  }>;
  designerContext?: {
    name: string;
    statedApproach?: string | null;
    knownPhilosophy?: string[];
  } | null;
  narrativeBrief?: NarrativeBriefData;
}

/**
 * Manages conversation context for real-time interviews
 * Handles rolling summaries, extraction accumulation, and angle tracking
 */
export class ContextManager {
  private context: ConversationContext;
  private anthropic: Anthropic;
  private maxRecentExchanges = 5;

  // Angle tracking for narrative coverage
  private coveredAngles: string[] = [];
  private coveredRooms: string[] = [];
  private briefData: BriefData | null = null;

  constructor(initialContext: ConversationContext, anthropic: Anthropic) {
    this.context = initialContext;
    this.anthropic = anthropic;
  }

  /**
   * Load narrative brief data for enriched context
   */
  loadBrief(brief: BriefData): void {
    this.briefData = brief;
  }

  /**
   * Mark a story angle as covered
   */
  markAngleCovered(angle: string): void {
    if (!this.coveredAngles.includes(angle)) {
      this.coveredAngles.push(angle);
    }
  }

  /**
   * Mark a room as covered
   */
  markRoomCovered(roomName: string): void {
    if (!this.coveredRooms.includes(roomName)) {
      this.coveredRooms.push(roomName);
    }
  }

  /**
   * Get angles not yet explored
   */
  getUnexploredAngles(): string[] {
    const allAngles = this.briefData?.narrativeBrief?.suggestedAngles || [];
    return allAngles.filter((a) => !this.coveredAngles.includes(a));
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

      // Track room coverage
      if (exchange.extractions.roomFocus) {
        this.markRoomCovered(exchange.extractions.roomFocus);
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
        model: MODELS.sonnet,
        thinking: { type: 'disabled' },
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
   * Build project context string for Sofia's prompt.
   * Uses narrative brief when available, falls back to raw data.
   */
  buildPromptContext(): { projectContext: string; designerContext: string } {
    // If we have a narrative brief, use the enriched format
    if (this.briefData?.narrativeBrief) {
      return this.buildNarrativePromptContext();
    }

    // Fallback: raw data format (backward compatible)
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
   * Build enriched prompt context from narrative brief
   */
  private buildNarrativePromptContext(): { projectContext: string; designerContext: string } {
    const nb = this.briefData!.narrativeBrief!;
    const dc = this.briefData!.designerContext;
    const vm = this.briefData!.vendorMap || [];

    // Vendor map formatted
    const vendorMapStr = vm
      .map((v) => {
        const parts = [`- ${v.name}: ${v.productCount} piece${v.productCount > 1 ? 's' : ''}`];
        if (v.rooms.length) parts.push(`(${v.rooms.join(', ')})`);
        if (v.heroProducts.length) parts.push(`— hero: ${v.heroProducts.join(', ')}`);
        if (v.isRepeatVendor) parts.push('— REPEAT VENDOR from prior projects');
        return parts.join(' ');
      })
      .join('\n') || 'No vendor data';

    // Hero moments
    const heroStr = (nb.heroMoments || [])
      .map((h) => `- ${h.description} (${h.roomName}) — ${h.whyNotable}`)
      .join('\n') || 'None identified';

    // Prior work connections
    const priorStr = nb.priorWorkConnections
      ? nb.priorWorkConnections
          .map((p) => `- ${p.observation}`)
          .join('\n')
      : 'None';

    // Angle tracking
    const unexploredAngles = this.getUnexploredAngles();
    const angleTrackingStr = this.coveredAngles.length > 0
      ? `\nANGLES ALREADY EXPLORED:\n${this.coveredAngles.map((a) => `- ${a}`).join('\n')}\n\nSUGGESTED NEXT TERRITORY: ${unexploredAngles[0] || 'Wrap up — all angles covered'}`
      : '';

    const projectContext = `PROJECT BRIEF — FOR YOUR EYES ONLY:

VISUAL IMPRESSION:
${nb.visualImpression || 'Not available'}

YOUR RESEARCH NOTES (observations that will impress the designer):
${(nb.researchNotes || []).map((n) => `- ${n}`).join('\n') || '- None available'}

VENDOR MAP:
${vendorMapStr}

STORY ANGLES TO PURSUE:
${(nb.suggestedAngles || []).map((a) => `- ${a}`).join('\n') || '- None identified'}

HERO MOMENTS (these define the project):
${heroStr}

PRIOR WORK CONNECTIONS (use only if natural):
${priorStr}

RULES:
- Reference specific products, vendors, and rooms by name — you studied this project
- Prior work references must connect to something specific in THIS project
- Track which suggested angles you've explored. Move to new territory, don't circle.
${angleTrackingStr}`;

    const designerContext = dc
      ? `
DESIGNER: ${dc.name}
${dc.statedApproach ? `Known approach: ${dc.statedApproach}` : ''}
${dc.knownPhilosophy && dc.knownPhilosophy.length > 0 ? `Known philosophy from prior interviews: ${dc.knownPhilosophy.join('; ')}` : ''}`
      : `
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

    // Add angle tracking to continuation context
    let angleTracking = '';
    if (this.coveredAngles.length > 0) {
      const unexplored = this.getUnexploredAngles();
      angleTracking = `\nANGLES EXPLORED: ${this.coveredAngles.length}/${(this.briefData?.narrativeBrief?.suggestedAngles || []).length}`;
      if (unexplored.length > 0) {
        angleTracking += `\nNEXT TERRITORY: ${unexplored[0]}`;
      }
    }

    return `${summary}${recent}\n\n${extractions}${angleTracking}`;
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

    // Also consider angle coverage
    const unexploredAngles = this.getUnexploredAngles();
    const allAnglesCovered = this.briefData?.narrativeBrief?.suggestedAngles
      ? unexploredAngles.length === 0
      : false;

    return (hasEnoughTurns && (hasEnoughQuotes || hasGoodCoverage)) || allAnglesCovered;
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
