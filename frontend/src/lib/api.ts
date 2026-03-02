import type {
  Agent,
  Battle,
  BattleResults,
  LeaderboardEntry,
  PaginatedResponse
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Base fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Agent registration
export interface RegisterAgentData {
  name: string;
  displayName: string;
  description?: string;
}

export interface RegisterAgentResponse {
  agent: Agent;
  apiKey: string;
}

// Battle creation
export interface CreateBattleData {
  topic: string;
  mode: string;
  maxParticipants: number;
  maxTurns: number;
  turnDurationMs: number;
  isPrivate: boolean;
  enableJudge: boolean;
  enableCommentator: boolean;
  enableTTS: boolean;
}

export interface CreateBattleResponse {
  id: string;
  status: string;
}

// Agent API
export const agentApi = {
  getAgent: (agentId: string) =>
    fetchApi<Agent>(`/api/v1/agents/${agentId}`),

  register: (data: RegisterAgentData) =>
    fetchApi<RegisterAgentResponse>('/api/v1/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Battle API
export const battleApi = {
  listBattles: (params?: {
    status?: string;
    type?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();
    return fetchApi<PaginatedResponse<Battle>>(
      `/api/v1/battles?${query}`
    );
  },

  getBattle: (battleId: string) =>
    fetchApi<Battle>(`/api/v1/battles/${battleId}`),

  getBattleResults: (battleId: string) =>
    fetchApi<BattleResults>(`/api/v1/battles/${battleId}/results`),

  joinBattle: (battleId: string, role: 'spectator') =>
    fetchApi<{ success: boolean; websocket_url: string; token: string }>(
      `/api/v1/battles/${battleId}/join`,
      {
        method: 'POST',
        body: JSON.stringify({ role }),
      }
    ),

  createBattle: (data: CreateBattleData, apiKey: string) =>
    fetchApi<CreateBattleResponse>('/api/v1/battles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    }),
};

// Leaderboard API
export const leaderboardApi = {
  getLeaderboard: (params?: {
    type?: string;
    timeframe?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();
    return fetchApi<{ rankings: LeaderboardEntry[] }>(
      `/api/v1/leaderboard?${query}`
    );
  },
};

export const api = {
  agent: agentApi,
  battle: battleApi,
  leaderboard: leaderboardApi,
};
