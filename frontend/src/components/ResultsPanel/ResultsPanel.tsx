import { Trophy, TrendingUp, Award, ThumbsUp } from 'lucide-react';
import type { Agent, JudgeDecision, VoteResults } from '@/types';

interface ResultsPanelProps {
  agents: Agent[];
  judgeDecision: JudgeDecision;
  votes: VoteResults;
}

export function ResultsPanel({ agents, judgeDecision, votes }: ResultsPanelProps) {
  const winner = agents.find((a) => a.id === judgeDecision.winner_id);
  const winnerScore = judgeDecision.scores[judgeDecision.winner_id];

  return (
    <div className="space-y-6">
      {/* Winner Announcement */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary rounded-lg p-8 text-center">
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {winner?.name} Wins!
        </h1>
        <p className="text-lg text-muted-foreground mb-4">
          Final Score: {winnerScore?.total.toFixed(1)}/100
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-primary" />
            <span>{votes.breakdown[judgeDecision.winner_id] || 0} spectator votes</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span>{judgeDecision.confidence}% confidence</span>
          </div>
        </div>
      </div>

      {/* Judge's Reasoning */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Judge's Decision
        </h2>
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
          {judgeDecision.reasoning}
        </p>
      </div>

      {/* Detailed Scores */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Detailed Scores
        </h2>
        <div className="space-y-6">
          {agents.map((agent) => {
            const score = judgeDecision.scores[agent.id];
            const feedback = judgeDecision.feedback[agent.id];
            const isWinner = agent.id === judgeDecision.winner_id;
            const spectatorVotes = votes.breakdown[agent.id] || 0;

            if (!score) return null;

            return (
              <div
                key={agent.id}
                className={`p-5 rounded-lg border-2 ${
                  isWinner
                    ? 'bg-primary/5 border-primary'
                    : 'bg-accent/30 border-border'
                }`}
              >
                {/* Agent Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="w-12 h-12 object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          {agent.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                        {agent.name}
                        {isWinner && <Trophy className="w-5 h-5 text-primary" />}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {spectatorVotes} spectator {spectatorVotes === 1 ? 'vote' : 'votes'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {score.total.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">out of 100</div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  {[
                    { label: 'Logic', value: score.logic_reasoning },
                    { label: 'Evidence', value: score.evidence_sources },
                    { label: 'Rhetoric', value: score.rhetoric_persuasion },
                    { label: 'Rebuttal', value: score.rebuttal_quality },
                    { label: 'Style', value: score.style_delivery },
                  ].map((metric) => (
                    <div key={metric.label} className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {metric.value.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metric.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feedback */}
                {feedback && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    {/* Strengths */}
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">
                        Strengths:
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {feedback.strengths.map((strength, idx) => (
                          <li key={idx}>{strength}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div>
                      <h4 className="font-semibold text-sm text-foreground mb-2">
                        Areas for Improvement:
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {feedback.weaknesses.map((weakness, idx) => (
                          <li key={idx}>{weakness}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Examples */}
                    {feedback.examples && (
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 bg-primary/5 rounded">
                          <h5 className="font-semibold text-xs text-primary mb-1">
                            Strong Moment:
                          </h5>
                          <p className="text-xs text-foreground">
                            {feedback.examples.strong_moment}
                          </p>
                        </div>
                        <div className="p-3 bg-destructive/5 rounded">
                          <h5 className="font-semibold text-xs text-destructive mb-1">
                            Weak Moment:
                          </h5>
                          <p className="text-xs text-foreground">
                            {feedback.examples.weak_moment}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Voting Summary */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Spectator Votes
        </h2>
        <div className="space-y-3">
          {agents.map((agent) => {
            const agentVotes = votes.breakdown[agent.id] || 0;
            const percentage = votes.total > 0 ? (agentVotes / votes.total) * 100 : 0;

            return (
              <div key={agent.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {agent.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {agentVotes} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Total: {votes.total} {votes.total === 1 ? 'vote' : 'votes'}
        </p>
      </div>
    </div>
  );
}
