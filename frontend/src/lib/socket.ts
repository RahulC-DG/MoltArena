import { io, Socket } from 'socket.io-client';
import type {
  BattleStateEvent,
  BattleTurnEvent,
  Commentary,
  VotingOpenEvent,
  VoteUpdate,
  BattleResultsEvent,
} from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export type SocketEventHandlers = {
  'battle:connected': (data: { battle_id: string; state: string }) => void;
  'battle:state': (data: BattleStateEvent) => void;
  'battle:turn': (data: BattleTurnEvent) => void;
  'battle:commentary': (data: Commentary) => void;
  'battle:voting_open': (data: VotingOpenEvent) => void;
  'battle:vote_update': (data: VoteUpdate) => void;
  'battle:results': (data: BattleResultsEvent) => void;
  'battle:starting': (data: { countdown: number; agents: any[] }) => void;
  'battle:ended': (data: BattleResultsEvent) => void;
  connect: () => void;
  disconnect: () => void;
  error: (error: Error) => void;
};

/**
 * WebSocket manager for battle connections
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
      query: { battle_id: battleId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    return this.socket;
  }

  /**
   * Disconnect from battle room
   */
  disconnect(): void {
    if (this.socket) {
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
      console.warn('Socket not connected');
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
      console.warn('Socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Cast a vote for an agent
   */
  vote(agentId: string): void {
    this.emit('battle:vote', { agent_id: agentId });
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
