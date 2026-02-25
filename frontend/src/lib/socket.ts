import { io, Socket } from 'socket.io-client';
import type {
  BattleConnectedEvent,
  BattleStateEvent,
  BattleStartingEvent,
  BattleTurnEvent,
  BattleCommentaryEvent,
  VotingOpenEvent,
  VoteRecordedEvent,
  VoteUpdateEvent,
  BattleEndedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  PositionAssignedEvent,
} from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export type SocketEventHandlers = {
  // Connection events
  connected: (data: { socketId: string; role: 'agent' | 'spectator'; agentId?: string }) => void;
  connect: () => void;
  disconnect: () => void;
  error: (data: { code: string; message: string; details?: any }) => void;

  // Battle room events
  'battle:connected': (data: BattleConnectedEvent) => void;
  'battle:participant_joined': (data: ParticipantJoinedEvent) => void;
  'battle:participant_left': (data: ParticipantLeftEvent) => void;
  'battle:position_assigned'?: (data: PositionAssignedEvent) => void;

  // Battle state events (Phase 1E)
  'battle:state': (data: BattleStateEvent) => void;
  'battle:starting': (data: BattleStartingEvent) => void;
  'battle:turn': (data: BattleTurnEvent) => void;
  'battle:commentary': (data: BattleCommentaryEvent) => void;
  'battle:ended': (data: BattleEndedEvent) => void;

  // Voting events (Phase 1F)
  'battle:voting_open': (data: VotingOpenEvent) => void;
  'battle:vote_recorded': (data: VoteRecordedEvent) => void;
  'battle:vote_update': (data: VoteUpdateEvent) => void;
};

/**
 * WebSocket manager for battle connections (Phase 1E Backend Compatible)
 */
export class BattleSocket {
  private socket: Socket | null = null;
  private battleId: string | null = null;

  /**
   * Connect to a battle room
   */
  connect(battleId: string, token?: string): Socket {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.battleId = battleId;
    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Auto-join battle room on connection
    this.socket.on('connect', () => {
      console.log('[Socket] Connected, joining battle:', battleId);
      this.emit('battle:join', { battleId });
    });

    return this.socket;
  }

  /**
   * Disconnect from battle room
   */
  disconnect(): void {
    if (this.socket && this.battleId) {
      this.emit('battle:leave', { battleId: this.battleId });
      this.socket.disconnect();
      this.socket = null;
      this.battleId = null;
    }
  }

  /**
   * Register event listener
   */
  on<K extends keyof SocketEventHandlers>(
    event: K,
    handler: SocketEventHandlers[K]
  ): void {
    if (!this.socket) {
      console.warn('[Socket] Cannot register handler: not connected');
      return;
    }
    this.socket.on(event, handler as any);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SocketEventHandlers>(
    event: K,
    handler?: SocketEventHandlers[K]
  ): void {
    if (!this.socket) return;
    this.socket.off(event, handler as any);
  }

  /**
   * Emit event to server
   */
  emit(event: string, data?: any): void {
    if (!this.socket) {
      console.warn('[Socket] Cannot emit: not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Cast a vote for an agent (Phase 1F)
   */
  vote(agentId: string): void {
    if (!this.battleId) {
      console.error('[Socket] Cannot vote: no active battle');
      return;
    }
    // Use camelCase to match backend Phase 1E
    this.emit('battle:vote', { battleId: this.battleId, agentId });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get current battle ID
   */
  getBattleId(): string | null {
    return this.battleId;
  }
}

// Export singleton instance
export const battleSocket = new BattleSocket();
