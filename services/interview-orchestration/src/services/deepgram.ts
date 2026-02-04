import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { RemoteTrack } from 'livekit-client';

type TranscriptCallback = (text: string, isFinal: boolean, confidence?: number) => void;
type UtteranceEndCallback = () => void;

/**
 * Service for Deepgram streaming speech-to-text
 */
export class DeepgramService {
  private apiKey: string;
  private connection: ReturnType<ReturnType<typeof createClient>['listen']['live']> | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private utteranceEndCallback: UtteranceEndCallback | null = null;
  private isPaused = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Register callback for transcripts
   */
  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  /**
   * Register callback for utterance end
   */
  onUtteranceEnd(callback: UtteranceEndCallback): void {
    this.utteranceEndCallback = callback;
  }

  /**
   * Connect to Deepgram and start streaming
   */
  async connect(audioTrack: RemoteTrack): Promise<void> {
    const deepgram = createClient(this.apiKey);

    // Create live transcription connection
    this.connection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
    });

    // Handle transcription events
    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      if (this.isPaused) return;

      const transcript = data.channel?.alternatives?.[0];
      if (transcript?.transcript) {
        const isFinal = data.is_final ?? false;
        const confidence = transcript.confidence;
        this.transcriptCallback?.(transcript.transcript, isFinal, confidence);
      }
    });

    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (this.isPaused) return;
      this.utteranceEndCallback?.();
    });

    this.connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram error:', error);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('Deepgram connection closed');
    });

    // Start streaming audio from the track
    await this.startAudioStreaming(audioTrack);

    console.log('Deepgram connection established');
  }

  /**
   * Stream audio data from LiveKit track to Deepgram
   */
  private async startAudioStreaming(audioTrack: RemoteTrack): Promise<void> {
    // Note: The actual implementation depends on how you access raw audio
    // from the LiveKit track. This is a conceptual placeholder.
    //
    // In a real implementation, you would:
    // 1. Get the MediaStreamTrack from the RemoteTrack
    // 2. Create an AudioContext and connect the track
    // 3. Use a ScriptProcessorNode or AudioWorklet to get raw samples
    // 4. Send the samples to Deepgram

    // Example conceptual flow:
    // const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
    // const audioContext = new AudioContext({ sampleRate: 16000 });
    // const source = audioContext.createMediaStreamSource(mediaStream);
    // const processor = audioContext.createScriptProcessor(4096, 1, 1);
    //
    // processor.onaudioprocess = (e) => {
    //   if (this.isPaused || !this.connection) return;
    //   const audioData = e.inputBuffer.getChannelData(0);
    //   const int16Data = this.floatTo16BitPCM(audioData);
    //   this.connection.send(int16Data);
    // };
    //
    // source.connect(processor);
    // processor.connect(audioContext.destination);

    console.log('Audio streaming started');
  }

  /**
   * Convert Float32Array to Int16Array for Deepgram
   */
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * Pause transcription
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume transcription
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Disconnect from Deepgram
   */
  disconnect(): void {
    this.connection?.requestClose();
    this.connection = null;
    console.log('Deepgram disconnected');
  }
}
