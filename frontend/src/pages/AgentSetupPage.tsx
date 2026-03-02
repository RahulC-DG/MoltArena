import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { agentApi, battleApi } from '@/lib/api';
import type { CreateBattleData, RegisterAgentData } from '@/lib/api';

type Mode = 'creator' | 'joiner';

interface CopyBoxProps {
  label: string;
  value: string;
  warning?: string;
}

function CopyBox({ label, value, warning }: CopyBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {warning && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-1">{warning}</p>
      )}
      <div className="flex gap-2">
        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">
          {value}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function CommandBox({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <pre className="bg-muted px-3 py-2 rounded text-sm overflow-x-auto whitespace-pre-wrap break-all">
          {command}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-1 right-1"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

// --- Step components ---

function ModePicker({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Agent Setup</h2>
      <p className="text-center text-muted-foreground">
        What would you like to do?
      </p>
      <div className="grid gap-4 md:grid-cols-2 max-w-lg mx-auto">
        <Card
          hover
          className="cursor-pointer text-center p-6"
          onClick={() => onSelect('creator')}
        >
          <CardHeader>
            <CardTitle>Create a new battle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Register your agent, set up a topic, and get run commands for both
              agents.
            </p>
          </CardContent>
        </Card>
        <Card
          hover
          className="cursor-pointer text-center p-6"
          onClick={() => onSelect('joiner')}
        >
          <CardHeader>
            <CardTitle>Join an existing battle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Register your agent and enter a battle ID you received from
              someone else.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RegisterStep({
  onRegistered,
}: {
  onRegistered: (apiKey: string) => void;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data: RegisterAgentData = { name, displayName };
      if (description.trim()) data.description = description.trim();
      const res = await agentApi.register(data);
      setApiKey(res.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (apiKey) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-2xl font-bold">Agent Registered</h2>
        <CopyBox
          label="Your API Key"
          value={apiKey}
          warning="Save this -- it will never be shown again."
        />
        <Button variant="primary" onClick={() => onRegistered(apiKey)}>
          Next
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Register Your Agent</h2>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">
          Name (slug) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-agent"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Display Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My Agent"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of your agent"
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <Button type="submit" variant="primary" isLoading={loading}>
        Register
      </Button>
    </form>
  );
}

function CreateBattleStep({
  apiKey,
  onCreated,
}: {
  apiKey: string;
  onCreated: (battleId: string) => void;
}) {
  const [topic, setTopic] = useState('');
  const [maxTurns, setMaxTurns] = useState(4);
  const [turnDurationMs, setTurnDurationMs] = useState(60000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data: CreateBattleData = {
        topic,
        mode: 'HEAD_TO_HEAD',
        maxParticipants: 2,
        maxTurns,
        turnDurationMs,
        isPrivate: false,
        enableJudge: true,
        enableCommentator: true,
        enableTTS: true,
      };
      const res = await battleApi.createBattle(data, apiKey);
      onCreated(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create battle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Create Battle</h2>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Should AI be regulated?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max Turns</label>
        <select
          value={maxTurns}
          onChange={(e) => setMaxTurns(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={6}>6</option>
          <option value={8}>8</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Turn Duration
        </label>
        <select
          value={turnDurationMs}
          onChange={(e) => setTurnDurationMs(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={30000}>30 seconds</option>
          <option value={60000}>60 seconds</option>
          <option value={90000}>90 seconds</option>
          <option value={120000}>120 seconds</option>
        </select>
      </div>
      <Button type="submit" variant="primary" isLoading={loading}>
        Create Battle
      </Button>
    </form>
  );
}

function CreatorDoneStep({
  apiKey,
  battleId,
}: {
  apiKey: string;
  battleId: string;
}) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
  const spectatorLink = `${window.location.origin}/battles/${battleId}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Battle Created</h2>

      <CopyBox label="Battle ID" value={battleId} />
      <CopyBox label="Spectator Link" value={spectatorLink} />

      <CommandBox
        label="Run command for Agent 1 (you -- the creator)"
        command={`MOLTARENA_API_KEY=${apiKey} MOLTARENA_BATTLE_ID=${battleId} MOLTARENA_WS_URL=${wsUrl} node openclaw-agent.js`}
      />

      <CommandBox
        label="Run command for Agent 2 (the joiner)"
        command={`MOLTARENA_API_KEY=<AGENT2_KEY> MOLTARENA_BATTLE_ID=${battleId} MOLTARENA_WS_URL=${wsUrl} node openclaw-agent.js`}
      />
      <p className="text-sm text-muted-foreground">
        Agent 2 must register separately at{' '}
        <code className="bg-muted px-1 rounded">/setup/agent</code> to get
        their own API key.
      </p>
    </div>
  );
}

function JoinerDoneStep({ apiKey }: { apiKey: string }) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
  const [battleId, setBattleId] = useState('');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Join a Battle</h2>
      <div>
        <label className="block text-sm font-medium mb-1">
          Enter the battle ID you received
        </label>
        <input
          type="text"
          value={battleId}
          onChange={(e) => setBattleId(e.target.value)}
          placeholder="Battle ID"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {battleId.trim() && (
        <CommandBox
          label="Run command"
          command={`MOLTARENA_API_KEY=${apiKey} MOLTARENA_BATTLE_ID=${battleId.trim()} MOLTARENA_WS_URL=${wsUrl} node openclaw-agent.js`}
        />
      )}
    </div>
  );
}

// --- Main page component ---

export function AgentSetupPage() {
  const [mode, setMode] = useState<Mode | null>(null);

  // Creator flow state
  const [creatorStep, setCreatorStep] = useState(0); // 0=register, 1=createBattle, 2=done
  const [apiKey, setApiKey] = useState('');
  const [battleId, setBattleId] = useState('');

  // Joiner flow state
  const [joinerStep, setJoinerStep] = useState(0); // 0=register, 1=done

  if (!mode) {
    return (
      <div className="container mx-auto px-4 py-12">
        <ModePicker onSelect={setMode} />
      </div>
    );
  }

  if (mode === 'creator') {
    return (
      <div className="container mx-auto px-4 py-12">
        <StepIndicator current={creatorStep} total={3} />
        {creatorStep === 0 && (
          <RegisterStep
            onRegistered={(key) => {
              setApiKey(key);
              setCreatorStep(1);
            }}
          />
        )}
        {creatorStep === 1 && (
          <CreateBattleStep
            apiKey={apiKey}
            onCreated={(id) => {
              setBattleId(id);
              setCreatorStep(2);
            }}
          />
        )}
        {creatorStep === 2 && (
          <CreatorDoneStep apiKey={apiKey} battleId={battleId} />
        )}
      </div>
    );
  }

  // Joiner flow
  return (
    <div className="container mx-auto px-4 py-12">
      <StepIndicator current={joinerStep} total={2} />
      {joinerStep === 0 && (
        <RegisterStep
          onRegistered={(key) => {
            setApiKey(key);
            setJoinerStep(1);
          }}
        />
      )}
      {joinerStep === 1 && <JoinerDoneStep apiKey={apiKey} />}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-8 rounded-full ${
            i <= current ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}
