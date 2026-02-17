import { ContextManager } from './context.js';
import { buildSystemPrompt, buildContinuationPrompt, buildClosingPrompt, SOFIA_OPENING_PROMPT } from './persona.js';
import type {
  SessionState,
  SessionConfig,
  ConversationContext,
  SofiaResponse,
  SegmentData,
  DataMessage,
} from '../types.js';
import { prisma } from '../prisma/client.js';
import { ClaudeService } from '../services/claude.js';
import { LiveKitService } from '../services/livekit.js';
import { DeepgramService } from '../services/deepgram.js';
import { CartesiaService } from '../services/cartesia.js';
import { config } from '../config.js';

interface ConversationManagerConfig {
  sessionId: string;
  projectId: string;
  roomName: string;
  onStateChange?: (state: SessionState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onExtraction?: (extraction: SofiaResponse['extractions']) => void;
  onMessage?: (message: DataMessage) => void;
}

/**
 * Manages the full conversation lifecycle for a real-time interview
 */
export class ConversationManager {
  private state: SessionState = 'initializing';
  private sessionId: string;
  private projectId: string;
  private roomName: string;

  private contextManager: ContextManager | null = null;
  private claude: ClaudeService;
  private livekit: LiveKitService;
  private deepgram: DeepgramService | null = null;
  private cartesia: CartesiaService;

  private currentSegmentNumber = 0;
  private currentTranscript = '';
  private silenceTimeout: NodeJS.Timeout | null = null;
  private speakingStartTime: number | null = null;
  private sessionStartTime: number | null = null;

  private config: ConversationManagerConfig;

  // Configurable thresholds
  private readonly SILENCE_THRESHOLD_MS = 1500;
  private readonly MIN_UTTERANCE_LENGTH = 10;

  constructor(managerConfig: ConversationManagerConfig) {
    this.sessionId = managerConfig.sessionId;
    this.projectId = managerConfig.projectId;
    this.roomName = managerConfig.roomName;
    this.config = managerConfig;

    this.claude = new ClaudeService(config.anthropic.apiKey);
    this.livekit = new LiveKitService(config.livekit);
    this.cartesia = new CartesiaService(config.cartesia);
  }

  /**
   * Start the interview session
   */
  async start(): Promise<void> {
    this.setState('initializing');
    this.sessionStartTime = Date.now();

    try {
      // Load project context
      const context = await this.loadProjectContext();
      this.contextManager = new ContextManager(context, this.claude.getClient());

      // Connect to LiveKit
      await this.livekit.connect(this.roomName);
      this.setupAudioPipeline();

      // Deliver opening
      this.setState('greeting');
      await this.deliverOpening();

      // Start listening
      this.setState('listening');
    } catch (error) {
      console.error('Failed to start session:', error);
      this.setState('ended');
      this.sendMessage({ type: 'error', error: 'Failed to start session' });
      throw error;
    }
  }

  /**
   * Load project context from database, including cached interview brief
   */
  private async loadProjectContext(): Promise<ConversationContext> {
    const [project, post] = await Promise.all([
      prisma.project.findUnique({
        where: { id: this.projectId },
        include: {
          designer: true,
          images: {
            orderBy: { displayOrder: 'asc' },
          },
          rooms: {
            include: {
              tags: {
                include: {
                  product: {
                    include: { vendor: true },
                  },
                },
              },
            },
          },
        },
      }),
      // Load cached interview brief from ProjectPost.provenance
      prisma.projectPost
        .findUnique({
          where: { projectId: this.projectId },
          select: { provenance: true },
        })
        .catch(() => null),
    ]);

    if (!project) {
      throw new Error(`Project not found: ${this.projectId}`);
    }

    const rooms = project.rooms.map((r) => r.name);
    const products = project.rooms.flatMap((r) =>
      r.tags.map((pt) => ({
        id: pt.id,
        productName: pt.product?.name || pt.productName || 'Unknown',
        vendorName: pt.product?.vendor?.name || null,
        category: pt.product?.category || null,
        roomName: r.name,
      }))
    );

    // Extract cached interview brief if available
    let interviewBrief = null;
    try {
      const provenance = post?.provenance as Record<string, unknown> | null;
      if (provenance?.interviewBrief) {
        const cached = provenance.interviewBrief as any;
        if (cached.visualNotes && Array.isArray(cached.researchNotes)) {
          interviewBrief = {
            visualNotes: cached.visualNotes,
            researchNotes: cached.researchNotes,
            suggestedAngles: cached.suggestedAngles || [],
            vendorMap: cached.vendorMap || [],
            designerContext: cached.designerContext || null,
          };
        }
      }
    } catch {
      // Brief parsing failed — will use fallback raw context
    }

    return {
      projectId: project.id,
      projectName: project.title || 'Untitled Project',
      designerName: project.designer?.name || 'Designer',
      designerBio: project.designer?.bio || null,
      images: project.images.map((img) => ({
        id: img.id,
        url: img.url,
        roomName: img.room || null,
        aiClassification: null, // Would need to parse from aiTags if available
      })),
      products,
      rooms,
      interviewBrief,
      summary: '',
      turnCount: 0,
      extractedQuotes: [],
      extractedProducts: [],
      extractedThemes: [],
      coveredAngles: [],
      recentExchanges: [],
    };
  }

  /**
   * Set up the audio processing pipeline
   */
  private setupAudioPipeline(): void {
    // Handle incoming audio from designer
    this.livekit.onAudioTrack((track) => {
      this.deepgram = new DeepgramService(config.deepgram.apiKey);
      this.deepgram.onTranscript((text, isFinal) => {
        this.handleTranscript(text, isFinal);
      });
      this.deepgram.onUtteranceEnd(() => {
        this.handleUtteranceEnd();
      });
      this.deepgram.connect(track);
    });

    // Handle data messages from client
    this.livekit.onDataReceived((data) => {
      this.handleClientMessage(data);
    });

    // Handle disconnect
    this.livekit.onDisconnect(() => {
      this.handleDisconnect();
    });
  }

  /**
   * Handle incoming transcript from Deepgram
   */
  private handleTranscript(text: string, isFinal: boolean): void {
    if (this.state !== 'listening') return;

    this.currentTranscript = text;

    // Reset silence timer on new speech
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    if (isFinal && text.length >= this.MIN_UTTERANCE_LENGTH) {
      // Start silence timer
      this.silenceTimeout = setTimeout(() => {
        this.handleUtteranceEnd();
      }, this.SILENCE_THRESHOLD_MS);
    }

    // Emit for UI
    this.config.onTranscript?.(text, isFinal);
    this.sendMessage({ type: 'transcript', text });
  }

  /**
   * Handle end of designer utterance
   */
  private async handleUtteranceEnd(): Promise<void> {
    if (this.state !== 'listening') return;
    if (this.currentTranscript.length < this.MIN_UTTERANCE_LENGTH) return;

    this.setState('processing');

    const designerInput = this.currentTranscript;
    this.currentTranscript = '';

    try {
      // Save designer segment
      await this.saveSegment({
        role: 'designer',
        content: designerInput,
        startedAt: new Date(),
      });

      // Get AI response
      const response = await this.generateResponse(designerInput);

      // Update context
      await this.contextManager!.addExchange({
        role: 'designer',
        content: designerInput,
        timestamp: Date.now(),
      });

      await this.contextManager!.addExchange({
        role: 'ai',
        content: response.reply,
        timestamp: Date.now(),
        extractions: response.extractions,
      });

      // Emit extractions
      if (response.extractions) {
        this.config.onExtraction?.(response.extractions);
        this.sendMessage({
          type: 'extraction',
          extraction: {
            pullQuote: response.extractions.pullQuote || undefined,
            productMentions: response.extractions.productMentions?.map((p) => p.name),
            theme: response.extractions.theme || undefined,
            mood: response.extractions.mood || undefined,
          },
        });
      }

      // Save AI segment
      await this.saveSegment({
        role: 'ai',
        content: response.reply,
        startedAt: new Date(),
        extractedQuote: response.extractions.pullQuote || undefined,
        extractedProducts: response.extractions.productMentions?.map((p) => p.name),
        extractedMood: response.extractions.mood || undefined,
        linkedRoomName: response.extractions.roomFocus || undefined,
      });

      // Speak response
      this.setState('speaking');
      await this.speak(response.reply);

      // Check if we should wrap up
      if (!response.shouldContinue || this.contextManager!.shouldWrapUp()) {
        await this.close();
      } else {
        this.setState('listening');
      }
    } catch (error) {
      console.error('Error processing utterance:', error);
      this.sendMessage({ type: 'error', error: 'Failed to process response' });
      this.setState('listening');
    }
  }

  /**
   * Generate AI response using Claude
   */
  private async generateResponse(designerInput: string): Promise<SofiaResponse> {
    const { projectContext, designerContext } = this.contextManager!.buildPromptContext();
    const systemPrompt = buildSystemPrompt(projectContext, designerContext);

    const isClosing = this.contextManager!.shouldWrapUp();
    let userPrompt: string;

    if (isClosing) {
      const summary = this.contextManager!.getSessionSummary();
      userPrompt = buildClosingPrompt(
        summary.themes,
        summary.quotes.length,
        summary.products.map((p) => p.name)
      );
    } else {
      const conversationContext = this.contextManager!.buildConversationContext();
      userPrompt = buildContinuationPrompt(
        this.contextManager!.getContext().summary,
        this.contextManager!.getContext().recentExchanges
          .map((e) => `${e.role.toUpperCase()}: ${e.content}`)
          .join('\n\n'),
        conversationContext,
        designerInput
      );
    }

    return this.claude.generateResponse(systemPrompt, userPrompt);
  }

  /**
   * Deliver opening greeting
   */
  private async deliverOpening(): Promise<void> {
    const { projectContext, designerContext } = this.contextManager!.buildPromptContext();
    const systemPrompt = buildSystemPrompt(projectContext, designerContext);

    const response = await this.claude.generateResponse(systemPrompt, SOFIA_OPENING_PROMPT);

    await this.saveSegment({
      role: 'ai',
      content: response.reply,
      startedAt: new Date(),
    });

    this.sendMessage({
      type: 'segment',
      segment: {
        id: `segment-${this.currentSegmentNumber}`,
        role: 'ai',
        content: response.reply,
        timestamp: Date.now(),
      },
    });

    await this.speak(response.reply);
    this.setState('listening');
  }

  /**
   * Speak text using Cartesia TTS
   */
  private async speak(text: string): Promise<void> {
    this.speakingStartTime = Date.now();

    await this.cartesia.speak(text, {
      onAudioChunk: (chunk) => {
        this.livekit.publishAudio(chunk);
      },
      onInterrupt: () => {
        this.cartesia.stop();
        this.setState('listening');
      },
    });
  }

  /**
   * Save a conversation segment to the database
   */
  private async saveSegment(data: SegmentData): Promise<void> {
    this.currentSegmentNumber++;

    await prisma.realtimeConversationSegment.create({
      data: {
        sessionId: this.sessionId,
        sequenceNumber: this.currentSegmentNumber,
        role: data.role,
        content: data.content,
        startedAt: data.startedAt,
        endedAt: data.endedAt || new Date(),
        durationMs: data.durationMs,
        transcriptConfidence: data.transcriptConfidence,
        transcriptRaw: data.transcriptRaw,
        promptTokens: data.promptTokens,
        responseTokens: data.responseTokens,
        latencyMs: data.latencyMs,
        extractedQuote: data.extractedQuote,
        extractedProducts: data.extractedProducts || [],
        extractedMood: data.extractedMood,
        linkedRoomName: data.linkedRoomName,
        linkedImageIds: [],
        linkedProductIds: [],
      },
    });

    // Send segment to client
    this.sendMessage({
      type: 'segment',
      segment: {
        id: `segment-${this.currentSegmentNumber}`,
        role: data.role,
        content: data.content,
        timestamp: Date.now(),
        extractedQuote: data.extractedQuote,
      },
    });
  }

  /**
   * Close the interview session
   */
  private async close(): Promise<void> {
    this.setState('closing');

    try {
      const summary = this.contextManager!.getSessionSummary();
      const closing = await this.claude.generateResponse(
        buildSystemPrompt(
          this.contextManager!.buildPromptContext().projectContext,
          this.contextManager!.buildPromptContext().designerContext
        ),
        buildClosingPrompt(summary.themes, summary.quotes.length, summary.products.map((p) => p.name))
      );

      await this.saveSegment({
        role: 'ai',
        content: closing.reply,
        startedAt: new Date(),
      });

      await this.speak(closing.reply);

      // Finalize session
      const totalDuration = this.sessionStartTime
        ? Date.now() - this.sessionStartTime
        : null;

      await prisma.realtimeInterviewSession.update({
        where: { id: this.sessionId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          totalDurationMs: totalDuration,
          conversationSummary: summary.summary,
          extractedQuotes: summary.quotes,
          extractedProducts: summary.products,
          extractedThemes: summary.themes,
          turnCount: summary.turnCount,
        },
      });

      this.sendMessage({ type: 'complete' });
      this.setState('ended');
    } catch (error) {
      console.error('Error closing session:', error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Handle client messages (pause, resume, end)
   */
  private handleClientMessage(data: DataMessage): void {
    switch (data.type) {
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;
      case 'end':
        this.stop();
        break;
    }
  }

  /**
   * Handle unexpected disconnect
   */
  private handleDisconnect(): void {
    if (this.state !== 'ended') {
      prisma.realtimeInterviewSession
        .update({
          where: { id: this.sessionId },
          data: {
            status: 'ABANDONED',
            endedAt: new Date(),
            totalDurationMs: this.sessionStartTime
              ? Date.now() - this.sessionStartTime
              : null,
          },
        })
        .catch(console.error);
    }
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.deepgram?.disconnect();
    this.livekit.disconnect();
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
  }

  /**
   * Update state and notify listeners
   */
  private setState(state: SessionState): void {
    this.state = state;
    this.config.onStateChange?.(state);
    this.sendMessage({ type: 'state_change', state });
  }

  /**
   * Send message to client
   */
  private sendMessage(message: DataMessage): void {
    this.config.onMessage?.(message);
    this.livekit.sendData(message);
  }

  /**
   * Pause the interview
   */
  pause(): void {
    this.setState('paused');
    this.deepgram?.pause();
  }

  /**
   * Resume the interview
   */
  resume(): void {
    this.setState('listening');
    this.deepgram?.resume();
  }

  /**
   * Stop the interview
   */
  async stop(): Promise<void> {
    await this.close();
  }

  /**
   * Get current state
   */
  getState(): SessionState {
    return this.state;
  }
}
