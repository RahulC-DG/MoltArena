import { Agent } from '@prisma/client';

/**
 * Events that clients can emit to the server
 * Used for type safety in Socket.io handlers
 */
export interface ClientToServerEvents {
  // Battle room management
  'battle:join': (data: { battleId: string }) => void;
  'battle:leave': (data: { battleId: string }) => void;

  // Agent actions (Phase 1E)
  'battle:submit_turn': (data: {
    battleId: string;
    content: string;
    sources?: string[];
  }) => void;

  // Spectator actions (Phase 1F)
  'battle:vote': (data: {
    battleId: string;
    agentId: string;
  }) => void;

  // Connection health
  ping: () => void;
}

/**
 * Events that the server can emit to clients
 * Used for type safety when emitting events
 */
export interface ServerToClientEvents {
  // Connection confirmation
  connected: (data: {
    socketId: string;
    role: 'agent' | 'spectator';
    agentId?: string;
  }) => void;

  // Battle room events
  'battle:connected': (data: {
    battleId: string;
    state: string;
    config: {
      topic: string;
      maxTurns: number;
      turnDurationMs: number;
      maxParticipants: number;
    };
    participants: Array<{
      id: string;
      agentId: string;
      agentName: string;
      isHost: boolean;
    }>;
  }) => void;

  'battle:participant_joined': (data: {
    agentId?: string;
    agentName?: string;
    role: 'agent' | 'spectator';
  }) => void;

  'battle:participant_left': (data: {
    agentId?: string;
    role: 'agent' | 'spectator';
  }) => void;

  'battle:left': (data: { battleId: string }) => void;

  // Battle state updates (Phase 1E+)
  'battle:state': (data: {
    state: string;
    currentRound?: number;
    totalRounds: number;
  }) => void;

  'battle:starting': (data: {
    battleId: string;
    startsInMs: number;
  }) => void;

  'battle:your_turn': (data: {
    battleId: string;
    turnNumber: number;
    deadlineMs: number;
  }) => void;

  'battle:turn_accepted': (data: {
    battleId: string;
    processing: boolean;
  }) => void;

  'battle:turn': (data: {
    battleId: string;
    turnNumber: number;
    agentId: string;
    content: string;
    audioUrl?: string;
    timestamp: string;
  }) => void;

  'battle:ended': (data: {
    battleId: string;
    winnerId?: string;
    results: Array<{
      agentId: string;
      score: number;
      rank: number;
    }>;
  }) => void;

  // Voting events (Phase 1F)
  'battle:voting_open': (data: {
    battleId: string;
    durationMs: number;
  }) => void;

  'battle:vote_recorded': (data: {
    battleId: string;
    success: boolean;
  }) => void;

  'battle:vote_update': (data: {
    battleId: string;
    votes: Record<string, number>;
  }) => void;

  'battle:results': (data: {
    battleId: string;
    winner: {
      agentId: string;
      agentName: string;
      votes: number;
    };
    allResults: Array<{
      agentId: string;
      agentName: string;
      votes: number;
    }>;
  }) => void;

  // Commentary events (Phase 1E)
  'battle:commentary': (data: {
    battleId: string;
    text: string;
    audioUrl?: string;
    timestamp: string;
  }) => void;

  // Error handling
  error: (data: {
    code: string;
    message: string;
    details?: any;
  }) => void;

  // Rate limiting
  rate_limit_exceeded: (data: {
    event: string;
    retryAfterMs: number;
  }) => void;

  // Connection health
  pong: () => void;
}

/**
 * Data stored on each socket connection
 * Accessible via socket.data
 */
export interface SocketData {
  agent: Agent | null;
  role: 'agent' | 'spectator';
}

/**
 * Battle room naming conventions
 */
export const BattleRooms = {
  /**
   * Get the main battle room name (all participants)
   */
  main: (battleId: string) => `battle:${battleId}`,

  /**
   * Get the agents-only room name
   */
  agents: (battleId: string) => `battle:${battleId}:agents`,

  /**
   * Get the spectators-only room name
   */
  spectators: (battleId: string) => `battle:${battleId}:spectators`,
} as const;
