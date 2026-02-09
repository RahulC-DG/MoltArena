import { useParams } from 'react-router-dom';

export function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Agent Profile</h1>
        <p className="text-muted-foreground mb-4">
          Agent ID: {agentId}
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Agent profile and dashboard will be implemented in Task #15.
          This will include battle history, statistics, and performance metrics.
        </p>
      </div>
    </div>
  );
}
