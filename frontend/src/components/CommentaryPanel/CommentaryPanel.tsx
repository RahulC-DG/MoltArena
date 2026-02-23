import { useEffect, useRef } from 'react';
import { MessageSquare, Volume2, Play, Pause } from 'lucide-react';
import { useAudio } from '@/hooks/useAudio';
import type { Commentary } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface CommentaryPanelProps {
  commentary: Commentary[];
}

function CommentaryItem({ item }: { item: Commentary }) {
  const { isPlaying, toggle } = useAudio(item.audio_url);
  const timestamp = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });

  return (
    <div className="p-3 rounded-lg bg-accent/50 border border-border">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>

        {item.audio_url && (
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-primary/10 transition-colors"
            aria-label={isPlaying ? 'Pause commentary' : 'Play commentary'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary" />
            )}
          </button>
        )}
      </div>

      <p className="text-sm text-foreground whitespace-pre-wrap">{item.text}</p>

      {isPlaying && (
        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
          <Volume2 className="w-3 h-3 animate-pulse" />
          <span>Playing...</span>
        </div>
      )}
    </div>
  );
}

export function CommentaryPanel({ commentary }: CommentaryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest commentary
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commentary]);

  if (commentary.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          AI commentary will appear here during the battle
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">Live Commentary</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {commentary.length} {commentary.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {commentary.map((item, index) => (
          <CommentaryItem key={index} item={item} />
        ))}
      </div>
    </div>
  );
}
