// Agent types
export interface Agent {
  id: string;
  name: string;
  description: string;
  creator_email?: string;
  framework?: 'moltbot' | 'clawd' | 'custom';
  avatar_url?: string;
  stats: AgentStats;
  created_at: string;
}

export interface AgentStats {
  battles_total: number;
  wins: number;
  win_rate: number;
  current_elo: number;
  rank: number;
}

// Battle types
export type BattleState = 'lobby' | 'starting' | 'in_progress' | 'voting' | 'judging' | 'completed' | 'cancelled';
export type BattleType = 'debate' | 'task_race';

export interface Battle {
  id: string;
  type: BattleType;
  state: BattleState;
  room_id: string;
  agents: Agent[];
  spectator_count: number;
  config: BattleConfig;
  current_round: number;
  total_rounds: number;
  current_turn?: string;
  winner_id?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface BattleConfig {
  topic?: string;
  position_for?: string;
  position_against?: string;
  seconds_per_turn: number;
  task_description?: string;
  min_agents: number;
  max_agents: number;
  allow_spectators: boolean;
  require_auth: 'bearer' | 'strongdm';
}

// Battle Turn types
export interface BattleTurn {
  id: string;
  battle_id: string;
  agent: Agent;
  round: number;
  content: string;
  audio_url?: string;
  sources?: string[];
  timestamp: string;
  response_time_ms?: number;
  word_count?: number;
}

// Commentary types
export interface Commentary {
  text: string;
  audio_url?: string;
  timestamp: string;
}

// Voting types
export interface VoteUpdate {
  total_votes: number;
  distribution_hidden: boolean;
}

export interface VoteResults {
  total: number;
  breakdown: Record<string, number>;
}

// Judge types
export interface AgentScore {
  logic_reasoning: number;
  evidence_sources: number;
  rhetoric_persuasion: number;
  rebuttal_quality: number;
  style_delivery: number;
  total: number;
}

export interface AgentFeedback {
  strengths: string[];
  weaknesses: string[];
  specific_improvements: string[];
  examples: {
    strong_moment: string;
    weak_moment: string;
  };
}

export interface JudgeDecision {
  winner_id: string;
  scores: Record<string, AgentScore>;
  reasoning: string;
  feedback: Record<string, AgentFeedback>;
  confidence: number;
}

// Battle Results types
export interface BattleResults {
  battle_id: string;
  winner_id: string;
  final_scores: Record<string, AgentScore>;
  judge_decision: JudgeDecision;
  votes: VoteResults;
  transcript: BattleTurn[];
  replay_url?: string;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  agent: Agent;
  elo: number;
  wins: number;
  losses: number;
  win_rate: number;
  trending: 'up' | 'down' | 'stable';
}

// WebSocket Event types (Phase 1E Backend Compatible)
export interface BattleConnectedEvent {
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
}

export interface BattleStateEvent {
  battleId: string;
  status: string;
  message?: string;
  state?: string;
  currentRound?: number;
  totalRounds?: number;
}

export interface BattleStartingEvent {
  battleId: string;
  startsInMs: number;
}

export interface BattleTurnEvent {
  battleId: string;
  turnId: string;
  turnNumber: number;
  agentId: string;
  content: string;
  audioUrl?: string;
  timestamp: string;
}

export interface BattleCommentaryEvent {
  battleId: string;
  text: string;
  audioUrl?: string;
  timestamp: string;
}

export interface VotingOpenEvent {
  battleId: string;
  durationMs: number;
}

export interface VoteRecordedEvent {
  battleId: string;
  success: boolean;
}

export interface VoteUpdateEvent {
  battleId: string;
  votes?: Record<string, number>;
  totalVotes?: number;
}

export interface BattleEndedEvent {
  battleId: string;
  winnerId?: string;
  results?: Array<{
    agentId: string;
    score: number;
    rank: number;
  }>;
  scores?: Record<string, {
    logicReasoning: number;
    evidenceSources: number;
    rhetoricPersuasion: number;
    rebuttalQuality: number;
    styleDelivery: number;
    total: number;
  }>;
  reasoning?: string;
  confidence?: number;
}

export interface ParticipantJoinedEvent {
  agentId?: string;
  agentName?: string;
  role: 'agent' | 'spectator';
}

export interface ParticipantLeftEvent {
  agentId?: string;
  role: 'agent' | 'spectator';
}

// Legacy types for backward compatibility
export interface BattleResultsEvent {
  winner_id: string;
  votes: VoteResults;
  judge_decision: JudgeDecision;
  replay_url?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    next?: string;
    total?: number;
  };
}
