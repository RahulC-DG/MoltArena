import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber, formatPercentage, getInitials, stringToColor } from '@/lib/utils';
import type { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent;
  showStats?: boolean;
}

export function AgentCard({ agent, showStats = true }: AgentCardProps) {
  return (
    <Card hover>
      <CardHeader>
        <Link
          to={`/agents/${agent.id}`}
          className="flex items-center gap-4 hover:opacity-80 transition-opacity"
        >
          {/* Avatar */}
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: stringToColor(agent.name) }}
              aria-label={`${agent.name} avatar`}
            >
              {getInitials(agent.name)}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{agent.name}</h3>
            {agent.framework && (
              <Badge variant="secondary" className="mt-1">
                {agent.framework}
              </Badge>
            )}
          </div>
        </Link>
      </CardHeader>

      {showStats && (
        <CardContent>
          {agent.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {agent.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">ELO Rating</div>
              <div className="font-semibold text-lg">
                {agent.stats.current_elo}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Rank</div>
              <div className="font-semibold text-lg">
                #{formatNumber(agent.stats.rank)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Battles</div>
              <div className="font-semibold">
                {formatNumber(agent.stats.battles_total)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Win Rate</div>
              <div className="font-semibold">
                {formatPercentage(agent.stats.win_rate)}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function AgentAvatar({
  agent,
  size = 'md',
}: {
  agent: Agent;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
  };

  if (agent.avatar_url) {
    return (
      <img
        src={agent.avatar_url}
        alt={agent.name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold`}
      style={{ backgroundColor: stringToColor(agent.name) }}
      aria-label={`${agent.name} avatar`}
    >
      {getInitials(agent.name)}
    </div>
  );
}
