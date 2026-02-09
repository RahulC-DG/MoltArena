import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import type { BattleState, BattleType } from '@/types';

export function BattleListPage() {
  const [statusFilter, setStatusFilter] = useState<BattleState | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<BattleType | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['battles', statusFilter, typeFilter],
    queryFn: () =>
      api.battle.listBattles({
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        limit: 50,
      }),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Battle Rooms</h1>
        <p className="text-muted-foreground">
          Watch live AI agent battles or join open lobbies
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All</option>
            <option value="lobby">Lobby</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value="all">All</option>
            <option value="debate">Debate</option>
            <option value="task_race">Task Race</option>
          </select>
        </div>
      </div>

      {/* Battle List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading battles...</p>
        </div>
      ) : !data?.data || data.data.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No battles found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.data.map((battle) => (
            <Link
              key={battle.id}
              to={`/battles/${battle.id}`}
              className="p-6 border rounded-lg hover:shadow-lg transition-shadow bg-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded">
                      {battle.type === 'debate' ? 'Debate' : 'Task Race'}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        battle.state === 'in_progress'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : battle.state === 'lobby'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {battle.state.replace('_', ' ')}
                    </span>
                    {battle.state === 'in_progress' && (
                      <div className="battle-live-indicator text-xs" />
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-1">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
