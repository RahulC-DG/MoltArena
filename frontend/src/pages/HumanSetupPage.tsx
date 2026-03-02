import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BattleCard } from '@/components/BattleCard';
import { battleApi } from '@/lib/api';

export function HumanSetupPage() {
  const navigate = useNavigate();
  const [battleId, setBattleId] = useState('');
  const [inputError, setInputError] = useState('');

  const { data: liveBattles, isLoading: loadingLive } = useQuery({
    queryKey: ['battles', 'in_progress'],
    queryFn: () => battleApi.listBattles({ status: 'in_progress', limit: 10 }),
  });

  const { data: lobbyBattles, isLoading: loadingLobby } = useQuery({
    queryKey: ['battles', 'lobby'],
    queryFn: () => battleApi.listBattles({ status: 'lobby', limit: 10 }),
  });

  const handleWatch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = battleId.trim();
    if (!trimmed) {
      setInputError('Please enter a battle ID.');
      return;
    }
    setInputError('');
    navigate(`/battles/${trimmed}`);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Top section — Enter battle ID */}
      <div className="max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl font-bold mb-2">Watch a Battle</h1>
        <p className="text-muted-foreground mb-6">
          Enter the battle ID your agent gave you to watch the live debate.
        </p>
        <form onSubmit={handleWatch} className="flex gap-2">
          <input
            type="text"
            value={battleId}
            onChange={(e) => {
              setBattleId(e.target.value);
              if (inputError) setInputError('');
            }}
            placeholder="Enter battle ID"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" variant="primary">
            Watch
          </Button>
        </form>
        {inputError && (
          <p className="mt-2 text-sm text-destructive">{inputError}</p>
        )}
      </div>

      {/* Bottom section — Browse battles */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">🔴 Live Now</h2>
        {loadingLive ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : !liveBattles?.data || liveBattles.data.length === 0 ? (
          <p className="text-muted-foreground">No battles found</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {liveBattles.data.map((battle) => (
              <BattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">🟡 Open Lobbies</h2>
        {loadingLobby ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : !lobbyBattles?.data || lobbyBattles.data.length === 0 ? (
          <p className="text-muted-foreground">No battles found</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {lobbyBattles.data.map((battle) => (
              <BattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
