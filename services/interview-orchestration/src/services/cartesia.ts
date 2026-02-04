// Note: cartesia package types may vary - this is a conceptual implementation
// Adjust based on the actual Cartesia SDK

interface CartesiaConfig {
  apiKey: string;
  voiceId: string;
}

interface SpeakOptions {
  onAudioChunk: (chunk: Uint8Array) => void;
  onInterrupt?: () => void;
}

/**
 * Service for Cartesia text-to-speech
 */
export class CartesiaService {
  private config: CartesiaConfig;
  private isPlaying = false;
  private abortController: AbortController | null = null;

  constructor(config: CartesiaConfig) {
    this.config = config;
  }

  /**
   * Speak text using Cartesia TTS with streaming
   */
  async speak(text: string, options: SpeakOptions): Promise<void> {
    if (!text.trim()) return;

    this.isPlaying = true;
    this.abortController = new AbortController();

    try {
      const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.apiKey,
          'Content-Type': 'application/json',
          'Cartesia-Version': '2024-06-10',
        },
        body: JSON.stringify({
          model_id: 'sonic-english',
          transcript: text,
          voice: {
            mode: 'id',
            id: this.config.voiceId,
          },
          output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 24000,
          },
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Cartesia API error: ${error}`);
      }

      if (!response.body) {
        throw new Error('No response body from Cartesia');
      }

      // Stream the audio chunks
      const reader = response.body.getReader();

      while (this.isPlaying) {
        const { done, value } = await reader.read();

        if (done) break;

        if (value) {
          options.onAudioChunk(value);
        }
      }

      reader.releaseLock();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Intentional abort, call interrupt handler
        options.onInterrupt?.();
      } else {
        console.error('Cartesia TTS error:', error);
        throw error;
      }
    } finally {
      this.isPlaying = false;
      this.abortController = null;
    }
  }

  /**
   * Speak with WebSocket streaming (alternative for lower latency)
   */
  async speakStreaming(text: string, options: SpeakOptions): Promise<void> {
    if (!text.trim()) return;

    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://api.cartesia.ai/tts/websocket?api_key=${this.config.apiKey}&cartesia_version=2024-06-10`
      );

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            model_id: 'sonic-english',
            transcript: text,
            voice: {
              mode: 'id',
              id: this.config.voiceId,
            },
            output_format: {
              container: 'raw',
              encoding: 'pcm_f32le',
              sample_rate: 24000,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        if (!this.isPlaying) {
          ws.close();
          return;
        }

        if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buffer) => {
            options.onAudioChunk(new Uint8Array(buffer));
          });
        } else if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);
          if (message.done) {
            ws.close();
            resolve();
          }
        }
      };

      ws.onerror = (error) => {
        console.error('Cartesia WebSocket error:', error);
        ws.close();
        reject(error);
      };

      ws.onclose = () => {
        this.isPlaying = false;
        resolve();
      };

      // Store reference for stopping
      const cleanup = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      // Allow stopping from outside
      const originalStop = this.stop.bind(this);
      this.stop = () => {
        cleanup();
        options.onInterrupt?.();
        originalStop();
      };
    });
  }

  /**
   * Stop current playback
   */
  stop(): void {
    this.isPlaying = false;
    this.abortController?.abort();
  }

  /**
   * Check if currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}

/**
 * Sofia's voice configuration for Cartesia
 *
 * To set up the voice:
 * 1. Go to Cartesia dashboard
 * 2. Create a new voice or clone from a sample
 * 3. Configure characteristics:
 *    - Base: Warm, mature female voice
 *    - Speed: 0.95 (slightly slower)
 *    - Stability: 0.7 (natural variation)
 *    - Clarity: 0.9 (professional)
 * 4. Save and copy the voice ID
 * 5. Set CARTESIA_VOICE_ID in environment
 */
export const SOFIA_VOICE_CONFIG = {
  // Recommended settings for the Sofia persona
  model: 'sonic-english',
  speed: 0.95,
  stability: 0.7,
  clarity: 0.9,
  description: 'Warm, measured, professional editorial journalist voice',
};
