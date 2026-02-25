/**
 * BattleViewer Component - Phase 1E Compatible
 *
 * This component handles real-time battle viewing with Phase 1E backend events.
 * It fetches agent data, enriches events, and displays the full battle experience.
 */

import { useState, useEffect, useRef } from 'react';
import { Swords, Users, Clock, Radio } from 'lucide-react';
import { useBattleSocket } from '@/hooks/useBattleSocket';
import { useSocketEvent } from '@/hooks/useBattleSocket';
import { TurnDisplay } from '@/components/TurnDisplay';
import { CommentaryPanel } from '@/components/CommentaryPanel';
import { VotingPanel } from '@/components/VotingPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import { agentApi } from '@/lib/api';
import type {
  Agent,
  BattleState,
  BattleTurnEvent,
  BattleCommentaryEvent,
  Commentary,
  JudgeDecision,
  VoteResults,
  AgentScore,
} from '@/types';

interface BattleViewerPhase1EProps {
  battleId: string;
  token?: string;
}

// Extended turn type with agent data
interface EnrichedTurn extends BattleTurnEvent {
  agent?: Agent;
  round?: number;
  audio_url?: string; // For backward compatibility
}

export function BattleViewerPhase1E({ battleId, token }: BattleViewerPhase1EProps) {
  // Battle state
  const [battleState, setBattleState] = useState<BattleState>('lobby');
  const [topic, setTopic] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentMap, setAgentMap] = useState<Map<string, Agent>>(new Map());

  // Turn state
  const [turns, setTurns] = useState<EnrichedTurn[]>([]);
  const [commentary, setCommentary] = useState<Commentary[]>([]);

  // Voting state
  const [votingOpen, setVotingOpen] = useState(false);
  const [votingTimeLimit, setVotingTimeLimit] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  // Results state
  const [judgeDecision, setJudgeDecision] = useState<JudgeDecision | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [spectatorCount] = useState(0);

  const turnsRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  const socket = useBattleSocket(battleId, token);

  // Helper function to fetch and cache agent data
  const fetchAgent = async (agentId: string): Promise<Agent | null> => {
    // Check cache first
    if (agentMap.has(agentId)) {
      return agentMap.get(agentId)!;
    }

    try {
      const agent = await agentApi.getAgent(agentId);
      setAgentMap(prev => new Map(prev).set(agentId, agent));
      return agent;
    } catch (error) {
      console.error('[BattleViewer] Failed to fetch agent:', agentId, error);
      // Create a minimal agent object as fallback
      const fallbackAgent: Agent = {
        id: agentId,
        name: `Agent ${agentId.slice(0, 8)}`,
        description: '',
        created_at: new Date().toISOString(),
        stats: {
          battles_total: 0,
          wins: 0,
          win_rate: 0,
          current_elo: 1200,
          rank: 0,
        },
      };
      setAgentMap(prev => new Map(prev).set(agentId, fallbackAgent));
      return fallbackAgent;
    }
  };

  // Socket event handlers
  useSocketEvent('connect', () => {
    console.log('[BattleViewer] Connected to WebSocket');
    setIsConnected(true);
  });

  useSocketEvent('disconnect', () => {
    console.log('[BattleViewer] Disconnected from WebSocket');
    setIsConnected(false);
  });

  // Handle battle:connected - Get initial config and participants
  useSocketEvent('battle:connected', async (data) => {
    console.log('[BattleViewer] Battle connected:', data);
    setTopic(data.config.topic);
    // maxTurns is total turns across all agents; for a 2-agent debate each
    // round consists of 2 turns, so display rounds = maxTurns / 2.
    setTotalRounds(Math.ceil(data.config.maxTurns / 2));

    // Sync to the battle's current state (handles joining mid-battle)
    const stateMap: Record<string, BattleState> = {
      LOBBY: 'lobby',
      STARTING: 'starting',
      IN_PROGRESS: 'in_progress',
      VOTING: 'voting',
      JUDGING: 'judging',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    };
    const mappedState = stateMap[data.state] || 'lobby';
    setBattleState(mappedState);
    if (mappedState === 'voting') setVotingOpen(true);

    // Fetch all participant agent data
    const participantAgentIds = data.participants
      .map(p => p.agentId)
      .filter((id): id is string => !!id);

    const agentPromises = participantAgentIds.map(id => fetchAgent(id));
    const fetchedAgents = await Promise.all(agentPromises);

    const validAgents = fetchedAgents.filter((a): a is Agent => a !== null);
    setAgents(validAgents);
  });

  // Handle participant joined
  useSocketEvent('battle:participant_joined', async (data) => {
    console.log('[BattleViewer] Participant joined:', data);

    if (data.role === 'agent' && data.agentId) {
      const agent = await fetchAgent(data.agentId);
      if (agent) {
        setAgents(prev => {
          if (prev.some(a => a.id === agent.id)) return prev;
          return [...prev, agent];
        });
      }
    }
  });

  // Handle battle starting countdown
  // Backend sends countdownSeconds (integer), but type definition says startsInMs.
  // Handle both to be safe against the mismatch.
  useSocketEvent('battle:starting', (data) => {
    console.log('[BattleViewer] Battle starting:', data);
    const raw = data as any;
    const countdownSeconds = raw.countdownSeconds ?? Math.ceil(data.startsInMs / 1000);
    setCountdown(countdownSeconds);
    setBattleState('starting');
  });

  // Handle battle state changes
  useSocketEvent('battle:state', (data) => {
    console.log('[BattleViewer] State change:', data);

    // Map backend status to BattleState
    const stateMap: Record<string, BattleState> = {
      LOBBY: 'lobby',
      STARTING: 'starting',
      IN_PROGRESS: 'in_progress',
      VOTING: 'voting',
      JUDGING: 'judging',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    };

    const mappedState = stateMap[data.status] || (data.state as BattleState) || 'lobby';
    setBattleState(mappedState);

    if (data.currentRound !== undefined) {
      setCurrentRound(data.currentRound);
    }
    if (data.totalRounds !== undefined) {
      setTotalRounds(data.totalRounds);
    }
  });

  // Handle new turn
  useSocketEvent('battle:turn', async (data) => {
    console.log('[BattleViewer] New turn:', data);

    // Fetch agent data if not cached
    const agent = await fetchAgent(data.agentId);

    // Create enriched turn with agent data
    const enrichedTurn: EnrichedTurn = {
      ...data,
      agent: agent || undefined, // Convert null to undefined
      round: data.turnNumber, // Map turnNumber to round for compatibility
      audio_url: data.audioUrl, // Add snake_case version for compatibility
    };

    setTurns(prev => [...prev, enrichedTurn]);

    // Derive currentRound from turnNumber since backend battle:state events
    // don't include currentRound. For a 2-agent debate, each round has 2 turns.
    const round = Math.ceil(data.turnNumber / 2);
    setCurrentRound(round);
  });

  // Handle commentary
  useSocketEvent('battle:commentary', (data: BattleCommentaryEvent) => {
    console.log('[BattleViewer] Commentary:', data);

    const comment: Commentary = {
      text: data.text,
      audio_url: data.audioUrl,
      timestamp: data.timestamp,
    };

    setCommentary(prev => [...prev, comment]);
  });

  // Handle voting open
  useSocketEvent('battle:voting_open', (data) => {
    console.log('[BattleViewer] Voting open:', data);
    const timeLimitSeconds = Math.ceil(data.durationMs / 1000);
    setVotingOpen(true);
    setVotingTimeLimit(timeLimitSeconds);
    setBattleState('voting');
  });

  // Handle vote recorded
  useSocketEvent('battle:vote_recorded', (data) => {
    console.log('[BattleViewer] Vote recorded:', data);
    if (data.success) {
      setHasVoted(true);
    }
  });

  // Handle vote updates
  useSocketEvent('battle:vote_update', (data) => {
    console.log('[BattleViewer] Vote update:', data);
    if (data.totalVotes !== undefined) {
      setTotalVotes(data.totalVotes);
    }
  });

  // Handle battle ended
  useSocketEvent('battle:ended', (data) => {
    console.log('[BattleViewer] Battle ended:', data);
    setBattleState('completed');
    setVotingOpen(false);

    // Transform Phase 1E results to frontend format
    if (data.scores && data.winnerId) {
      const transformedScores: Record<string, AgentScore> = {};

      Object.entries(data.scores).forEach(([agentId, score]) => {
        transformedScores[agentId] = {
          logic_reasoning: score.logicReasoning,
          evidence_sources: score.evidenceSources,
          rhetoric_persuasion: score.rhetoricPersuasion,
          rebuttal_quality: score.rebuttalQuality,
          style_delivery: score.styleDelivery,
          total: score.total,
        };
      });

      setJudgeDecision({
        winner_id: data.winnerId,
        scores: transformedScores,
        reasoning: data.reasoning || '',
        feedback: {}, // Backend doesn't send detailed feedback in Phase 1E
        confidence: data.confidence || 0,
      });

      // Transform vote results if available
      if (data.results) {
        const breakdown: Record<string, number> = {};
        let total = 0;

        data.results.forEach((result) => {
          breakdown[result.agentId] = result.score;
          total += result.score;
        });

        setVoteResults({
          total,
          breakdown,
        });
      }
    }
  });

  // Auto-scroll to latest turn
  useEffect(() => {
    if (turnsRef.current) {
      turnsRef.current.scrollTop = turnsRef.current.scrollHeight;
    }
  }, [turns]);

  // Countdown effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  // Handle vote
  const handleVote = (agentId: string) => {
    console.log('[BattleViewer] Voting for agent:', agentId);
    socket.vote(agentId);
    // Note: hasVoted will be set by battle:vote_recorded event
  };

  // State badges
  const getStateBadge = () => {
    const badges: Record<BattleState, { label: string; color: string }> = {
      lobby: { label: 'Waiting', color: 'bg-muted text-muted-foreground' },
      starting: { label: 'Starting', color: 'bg-primary/20 text-primary' },
      in_progress: { label: 'Live', color: 'bg-destructive/20 text-destructive animate-pulse' },
      voting: { label: 'Voting', color: 'bg-primary/20 text-primary' },
      judging: { label: 'Judging', color: 'bg-primary/20 text-primary' },
      completed: { label: 'Completed', color: 'bg-muted text-muted-foreground' },
      cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground' },
    };

    const badge = badges[battleState];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Swords className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {topic || 'Battle Arena'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Round {currentRound} of {totalRounds}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {getStateBadge()}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{spectatorCount} watching</span>
              </div>

              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Starting Countdown */}
        {battleState === 'starting' && countdown !== null && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Clock className="w-24 h-24 text-primary mx-auto mb-6 animate-pulse" />
              <h2 className="text-4xl font-bold text-foreground mb-2">
                Battle Starting In
              </h2>
              <div className="text-8xl font-bold text-primary">
                {countdown}
              </div>
              <div className="mt-6 flex items-center justify-center gap-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2 overflow-hidden">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt={agent.name} className="w-16 h-16 object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-primary">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lobby */}
        {battleState === 'lobby' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Radio className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Waiting for Battle to Start
              </h2>
              <p className="text-muted-foreground">
                The battle will begin once all agents have connected
              </p>
            </div>
          </div>
        )}

        {/* Battle In Progress - 3 Column Layout */}
        {(battleState === 'in_progress' || battleState === 'judging') && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
            {/* Left: Participants */}
            <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4 overflow-y-auto">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Participants
              </h2>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-3 rounded-lg bg-accent/30 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {agent.avatar_url ? (
                          <img src={agent.avatar_url} alt={agent.name} className="w-10 h-10 object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-primary">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {agent.stats?.current_elo || 1200} ELO
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Turn Feed */}
            <div className="lg:col-span-6 bg-card border border-border rounded-lg flex flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Battle Feed</h2>
              </div>
              <div
                ref={turnsRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {turns.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <Swords className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Waiting for the first turn...
                      </p>
                    </div>
                  </div>
                ) : (
                  turns.map((turn, index) => (
                    <TurnDisplay
                      key={turn.turnId || index}
                      turn={turn as any} // Cast to any to allow enriched format
                      isLatest={index === turns.length - 1}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right: Commentary */}
            <div className="lg:col-span-3 bg-card border border-border rounded-lg">
              <CommentaryPanel commentary={commentary} />
            </div>
          </div>
        )}

        {/* Voting */}
        {battleState === 'voting' && votingOpen && (
          <div className="h-full flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
              <VotingPanel
                agents={agents}
                timeLimit={votingTimeLimit}
                totalVotes={totalVotes}
                onVote={handleVote}
                hasVoted={hasVoted}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {battleState === 'completed' && judgeDecision && voteResults && (
          <div className="h-full overflow-y-auto p-4">
            <div className="max-w-5xl mx-auto">
              <ResultsPanel
                agents={agents}
                judgeDecision={judgeDecision}
                votes={voteResults}
              />
            </div>
          </div>
        )}

        {/* Completed fallback — joined after battle ended, no results available */}
        {battleState === 'completed' && (!judgeDecision || !voteResults) && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Swords className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Battle Has Ended
              </h2>
              <p className="text-muted-foreground">
                Results are unavailable. The battle may have ended before you joined.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
