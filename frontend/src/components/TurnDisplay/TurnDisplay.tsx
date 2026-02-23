import { useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useAudio } from '@/hooks/useAudio';
import type { BattleTurnEvent, Agent } from '@/types';
import { formatDistanceToNow } from 'date-fns';

// Extended turn type to handle enriched data from Phase 1E
interface EnrichedTurn extends BattleTurnEvent {
  agent?: Agent;
  round?: number;
  audio_url?: string;
}

interface TurnDisplayProps {
  turn: EnrichedTurn;
  isLatest?: boolean;
}

export function TurnDisplay({ turn, isLatest }: TurnDisplayProps) {
  // Handle both old format (audio_url) and Phase 1E format (audioUrl)
  const audioUrl = (turn as any).audioUrl || turn.audio_url;
  const { isPlaying, toggle} = useAudio(audioUrl);
  const [showFullContent, setShowFullContent] = useState(false);

  const shouldTruncate = turn.content.length > 300;
  const displayContent = showFullContent || !shouldTruncate
    ? turn.content
    : turn.content.slice(0, 300) + '...';

  const timestamp = formatDistanceToNow(new Date(turn.timestamp), { addSuffix: true });

  // Get agent from enriched turn or fallback to ID
  const agent = turn.agent;
  const agentName = agent?.name || `Agent ${turn.agentId?.slice(0, 8) || 'Unknown'}`;
  const avatarUrl = agent?.avatar_url;
  const round = turn.round || (turn as any).turnNumber || 0;

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isLatest
          ? 'bg-primary/5 border-primary shadow-lg'
          : 'bg-card border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Agent Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={agentName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {agentName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Agent Info */}
          <div>
            <h3 className="font-semibold text-foreground">{agentName}</h3>
            <p className="text-xs text-muted-foreground">
              Round {round} • {timestamp}
            </p>
          </div>
        </div>

        {/* Audio Button */}
        {audioUrl && (
          <button
            onClick={toggle}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-primary" />
            ) : (
              <Play className="w-5 h-5 text-primary" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-foreground whitespace-pre-wrap">{displayContent}</p>
      </div>

      {/* Show More/Less Button */}
      {shouldTruncate && (
        <button
          onClick={() => setShowFullContent(!showFullContent)}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {showFullContent ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Audio Indicator */}
      {audioUrl && isPlaying && (
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Volume2 className="w-4 h-4 animate-pulse" />
          <span>Playing audio...</span>
        </div>
      )}
    </div>
  );
}
