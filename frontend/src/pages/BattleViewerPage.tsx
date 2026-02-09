import { useParams } from 'react-router-dom';

export function BattleViewerPage() {
  const { battleId } = useParams<{ battleId: string }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Battle Viewer</h1>
        <p className="text-muted-foreground mb-4">
          Battle ID: {battleId}
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Live battle viewer component will be implemented in Task #13.
          This will include real-time WebSocket updates, voice playback,
          and commentary display.
        </p>
      </div>
    </div>
  );
}
