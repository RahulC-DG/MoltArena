import { useParams } from 'react-router-dom';
import { BattleViewerPhase1E } from '@/components/BattleViewer';

export function BattleViewerPage() {
  const { battleId } = useParams<{ battleId: string }>();

  if (!battleId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Battle Not Found</h1>
          <p className="text-muted-foreground">
            Invalid battle ID
          </p>
        </div>
      </div>
    );
  }

  return <BattleViewerPhase1E battleId={battleId} />;
}
