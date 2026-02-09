import { useAudio } from '@/hooks/useAudio';
import { formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface AudioPlayerProps {
  url: string;
  label?: string;
  className?: string;
}

export function AudioPlayer({ url, label = 'Audio', className }: AudioPlayerProps) {
  const { isPlaying, duration, currentTime, toggle, seek } = useAudio(url);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Play/Pause Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="flex-shrink-0"
      >
        {isPlaying ? (
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </Button>

      {/* Progress Bar */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              aria-label="Audio progress"
            />
            <div
              className="absolute top-0 left-0 h-1 bg-primary rounded-full pointer-events-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
            {formatDuration(Math.floor(currentTime))}/{formatDuration(Math.floor(duration))}
          </div>
        </div>
      </div>

      {/* Audio Visualization (when playing) */}
      {isPlaying && (
        <div className="flex items-center gap-1 flex-shrink-0" aria-hidden="true">
          <div className="audio-wave" />
          <div className="audio-wave" />
          <div className="audio-wave" />
          <div className="audio-wave" />
        </div>
      )}
    </div>
  );
}

export function SimpleAudioPlayer({ url, label }: AudioPlayerProps) {
  const { isPlaying, toggle } = useAudio(url);

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors"
      aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
    >
      {isPlaying ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex items-center gap-1">
            <div className="audio-wave" style={{ height: '12px' }} />
            <div className="audio-wave" style={{ height: '12px' }} />
            <div className="audio-wave" style={{ height: '12px' }} />
          </div>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          <span>{label || 'Play Audio'}</span>
        </>
      )}
    </button>
  );
}
