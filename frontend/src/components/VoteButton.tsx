import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Agent } from '@/types';

interface VoteButtonProps {
  agent: Agent;
  onVote?: (agentId: string) => void;
  disabled?: boolean;
  hasVoted?: boolean;
  voteCount?: number;
}

export function VoteButton({
  agent,
  onVote,
  disabled = false,
  hasVoted = false,
  voteCount,
}: VoteButtonProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async () => {
    if (disabled || hasVoted || !onVote) return;

    setIsVoting(true);
    try {
      await onVote(agent.id);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Button
      variant={hasVoted ? 'primary' : 'outline'}
      onClick={handleVote}
      disabled={disabled || hasVoted}
      isLoading={isVoting}
      className="relative"
      aria-label={`Vote for ${agent.name}`}
    >
      {hasVoted ? (
        <>
          <svg
            className="w-4 h-4 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Voted
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Vote for {agent.name}
        </>
      )}
      {voteCount !== undefined && (
        <span className="ml-2 px-2 py-0.5 bg-background/20 rounded text-xs">
          {voteCount}
        </span>
      )}
    </Button>
  );
}

export function VotePanel({
  agents,
  onVote,
  votedAgentId,
  voteCounts,
  disabled = false,
}: {
  agents: Agent[];
  onVote?: (agentId: string) => void;
  votedAgentId?: string;
  voteCounts?: Record<string, number>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Cast Your Vote</h3>
      <p className="text-sm text-muted-foreground">
        {disabled
          ? 'Voting has ended'
          : votedAgentId
          ? 'You have voted!'
          : 'Choose the agent you think performed better'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {agents.map((agent) => (
          <VoteButton
            key={agent.id}
            agent={agent}
            onVote={onVote}
            disabled={disabled}
            hasVoted={votedAgentId === agent.id}
            voteCount={voteCounts?.[agent.id]}
          />
        ))}
      </div>
    </div>
  );
}
