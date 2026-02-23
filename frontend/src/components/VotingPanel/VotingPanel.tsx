import { useState, useEffect } from 'react';
import { Check, Users, Clock } from 'lucide-react';
import type { Agent } from '@/types';

interface VotingPanelProps {
  agents: Agent[];
  timeLimit: number;
  totalVotes: number;
  onVote: (agentId: string) => void;
  hasVoted: boolean;
}

export function VotingPanel({
  agents,
  timeLimit,
  totalVotes,
  onVote,
  hasVoted,
}: VotingPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleVote = (agentId: string) => {
    if (hasVoted) return;
    setSelectedAgent(agentId);
    onVote(agentId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timePercentage = (timeRemaining / timeLimit) * 100;
  const isUrgent = timeRemaining <= 30;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Cast Your Vote
        </h2>
        <p className="text-sm text-muted-foreground">
          Vote for the agent you think performed best in this battle
        </p>
      </div>

      {/* Timer */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className={`w-4 h-4 ${isUrgent ? 'text-destructive' : 'text-primary'}`} />
            <span className={isUrgent ? 'text-destructive font-semibold' : 'text-foreground'}>
              {formatTime(timeRemaining)} remaining
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              isUrgent ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${timePercentage}%` }}
          />
        </div>
      </div>

      {/* Agent Voting Buttons */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const isSelected = selectedAgent === agent.id;
          const isDisabled = hasVoted && !isSelected;

          return (
            <button
              key={agent.id}
              onClick={() => handleVote(agent.id)}
              disabled={hasVoted || timeRemaining === 0}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'bg-primary border-primary text-primary-foreground shadow-lg'
                  : isDisabled
                  ? 'bg-muted border-border opacity-50 cursor-not-allowed'
                  : 'bg-card border-border hover:border-primary hover:bg-primary/5'
              } ${timeRemaining === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {agent.avatar_url ? (
                      <img
                        src={agent.avatar_url}
                        alt={agent.name}
                        className="w-12 h-12 object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-primary">
                        {agent.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Agent Info */}
                  <div>
                    <h3 className="font-semibold text-lg">{agent.name}</h3>
                    <p className="text-sm opacity-80">
                      {agent.description || 'AI Debater'}
                    </p>
                  </div>
                </div>

                {/* Check Icon */}
                {isSelected && (
                  <Check className="w-6 h-6 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Voting Status */}
      {hasVoted && (
        <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-lg">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Check className="w-4 h-4" />
            <span className="font-semibold">Vote submitted successfully!</span>
          </div>
        </div>
      )}

      {timeRemaining === 0 && !hasVoted && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-lg">
          <p className="text-sm text-destructive font-semibold">
            Voting period has ended
          </p>
        </div>
      )}
    </div>
  );
}
