import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import type { Battle } from '@/types';

interface BattleCardProps {
  battle: Battle;
}

export function BattleCard({ battle }: BattleCardProps) {
  const getStateBadgeVariant = (state: Battle['state']) => {
    switch (state) {
      case 'in_progress':
        return 'destructive';
      case 'lobby':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Link to={`/battles/${battle.id}`}>
      <Card hover className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="default">
                {battle.type === 'debate' ? 'Debate' : 'Task Race'}
              </Badge>
              <Badge variant={getStateBadgeVariant(battle.state)}>
                {battle.state.replace('_', ' ')}
              </Badge>
              {battle.state === 'in_progress' && (
                <div className="battle-live-indicator text-xs" />
              )}
            </div>
            <h3 className="font-semibold text-lg mb-1 line-clamp-2">
              {battle.config.topic || battle.config.task_description}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(battle.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>
              {battle.agents.length}/{battle.config.max_agents} agents
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span>{battle.spectator_count} watching</span>
          </div>

          {battle.state === 'in_progress' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                Round {battle.current_round}/{battle.total_rounds}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
