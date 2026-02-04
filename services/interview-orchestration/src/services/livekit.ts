import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
  DataPacket_Kind,
} from 'livekit-client';
import { AccessToken } from '@livekit/server-sdk';
import type { DataMessage } from '../types.js';

interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

type AudioTrackCallback = (track: RemoteTrack) => void;
type DataCallback = (data: DataMessage) => void;
type DisconnectCallback = () => void;

/**
 * Service for LiveKit room management
 */
export class LiveKitService {
  private config: LiveKitConfig;
  private room: Room | null = null;
  private audioTrackCallback: AudioTrackCallback | null = null;
  private dataCallback: DataCallback | null = null;
  private disconnectCallback: DisconnectCallback | null = null;

  constructor(config: LiveKitConfig) {
    this.config = config;
  }

  /**
   * Generate a token for joining a room
   */
  generateToken(roomName: string, identity: string, name?: string): string {
    const at = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity,
      name: name || identity,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return at.toJwt();
  }

  /**
   * Connect to a LiveKit room as the AI participant
   */
  async connect(roomName: string): Promise<void> {
    this.room = new Room();

    // Set up event handlers
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed.bind(this));
    this.room.on(RoomEvent.DataReceived, this.handleDataReceived.bind(this));
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));
    this.room.on(RoomEvent.ParticipantDisconnected, this.handleParticipantDisconnected.bind(this));

    // Generate token for AI participant
    const token = this.generateToken(roomName, 'sofia-ai', 'Sofia');

    // Connect to room
    await this.room.connect(this.config.url, token);
    console.log(`Connected to LiveKit room: ${roomName}`);
  }

  /**
   * Handle new track subscription
   */
  private handleTrackSubscribed(
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    _participant: RemoteParticipant
  ): void {
    if (track.kind === Track.Kind.Audio && this.audioTrackCallback) {
      this.audioTrackCallback(track);
    }
  }

  /**
   * Handle incoming data messages
   */
  private handleDataReceived(
    payload: Uint8Array,
    _participant?: RemoteParticipant,
    _kind?: DataPacket_Kind
  ): void {
    try {
      const message = JSON.parse(new TextDecoder().decode(payload)) as DataMessage;
      this.dataCallback?.(message);
    } catch (error) {
      console.error('Failed to parse data message:', error);
    }
  }

  /**
   * Handle room disconnection
   */
  private handleDisconnected(): void {
    console.log('Disconnected from LiveKit room');
    this.disconnectCallback?.();
  }

  /**
   * Handle participant disconnection
   */
  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    console.log(`Participant disconnected: ${participant.identity}`);
    // If the designer disconnects, treat it as session end
    if (participant.identity !== 'sofia-ai') {
      this.disconnectCallback?.();
    }
  }

  /**
   * Register callback for audio track
   */
  onAudioTrack(callback: AudioTrackCallback): void {
    this.audioTrackCallback = callback;
  }

  /**
   * Register callback for data messages
   */
  onDataReceived(callback: DataCallback): void {
    this.dataCallback = callback;
  }

  /**
   * Register callback for disconnect
   */
  onDisconnect(callback: DisconnectCallback): void {
    this.disconnectCallback = callback;
  }

  /**
   * Publish audio data to the room
   */
  publishAudio(audioData: Uint8Array): void {
    if (!this.room?.localParticipant) {
      console.warn('Cannot publish audio: not connected');
      return;
    }

    // Note: In production, you'd create a proper audio track
    // This is a placeholder for the audio publishing logic
    // The actual implementation depends on your audio format
  }

  /**
   * Send data message to all participants
   */
  sendData(message: DataMessage): void {
    if (!this.room?.localParticipant) {
      console.warn('Cannot send data: not connected');
      return;
    }

    const data = new TextEncoder().encode(JSON.stringify(message));
    this.room.localParticipant.publishData(data, { reliable: true });
  }

  /**
   * Disconnect from the room
   */
  disconnect(): void {
    this.room?.disconnect();
    this.room = null;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.room?.state === 'connected';
  }
}

/**
 * Create a LiveKit room on the server
 */
export async function createRoom(
  config: LiveKitConfig,
  roomName: string
): Promise<{ roomName: string; roomId: string }> {
  // Using the REST API to create a room
  // Note: LiveKit Cloud handles room creation automatically on first join
  // This is just for explicit room management if needed
  return {
    roomName,
    roomId: roomName, // In practice, this would come from the API response
  };
}
