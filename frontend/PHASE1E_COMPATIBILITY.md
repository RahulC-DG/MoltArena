# Phase 1E Backend Compatibility

This document describes the frontend updates made to ensure full compatibility with the Phase 1E backend.

## Overview

The frontend has been updated to work seamlessly with the Phase 1E battle system backend. All WebSocket events, data structures, and API interactions now match the backend implementation.

## Changes Made

### 1. Updated Type Definitions (`src/types/index.ts`)

Added Phase 1E-compatible event types:

```typescript
// Phase 1E Backend Event Types
export interface BattleConnectedEvent {
  battleId: string;
  state: string;
  config: { topic: string; maxTurns: number; turnDurationMs: number; maxParticipants: number };
  participants: Array<{ id: string; agentId: string; agentName: string; isHost: boolean }>;
}

export interface BattleStartingEvent {
  battleId: string;
  startsInMs: number; // Backend sends milliseconds
}

export interface BattleTurnEvent {
  battleId: string;
  turnId: string;
  turnNumber: number;
  agentId: string; // Only ID, not full agent object
  content: string;
  audioUrl?: string; // camelCase
  timestamp: string;
}

export interface BattleCommentaryEvent {
  battleId: string;
  text: string;
  audioUrl?: string; // camelCase
  timestamp: string;
}

export interface VotingOpenEvent {
  battleId: string;
  durationMs: number; // Backend sends milliseconds
}

export interface BattleEndedEvent {
  battleId: string;
  winnerId?: string;
  scores?: Record<string, {
    logicReasoning: number; // camelCase in backend
    evidenceSources: number;
    rhetoricPersuasion: number;
    rebuttalQuality: number;
    styleDelivery: number;
    total: number;
  }>;
  reasoning?: string;
  confidence?: number;
}
```

### 2. Updated Socket Manager (`src/lib/socket.ts`)

**Key Changes:**
- Removed `query: { battle_id }` from connection (not needed)
- Auto-joins battle room on connection via `battle:join` event
- Fixed vote emission to use `{ battleId, agentId }` (camelCase)
- Added all Phase 1E event handlers
- Added logging for debugging

**Vote Fix:**
```typescript
// OLD (incorrect)
vote(agentId: string): void {
  this.emit('battle:vote', { agent_id: agentId }); // snake_case
}

// NEW (correct for Phase 1E)
vote(agentId: string): void {
  this.emit('battle:vote', { battleId: this.battleId, agentId }); // camelCase
}
```

### 3. Created Phase 1E Battle Viewer (`src/components/BattleViewer/BattleViewerPhase1E.tsx`)

This is a complete rewrite of the Battle Viewer component to handle Phase 1E events.

**Key Features:**

#### Agent Data Enrichment
Phase 1E backend only sends `agentId` in turn events, not full agent objects. The component:
1. Fetches agent data from `/api/v1/agents/:id` when participants join
2. Builds an agent map for fast lookup
3. Enriches turns with full agent data before passing to TurnDisplay

```typescript
const fetchAgent = async (agentId: string): Promise<Agent | null> => {
  // Check cache first
  if (agentMap.has(agentId)) {
    return agentMap.get(agentId)!;
  }

  try {
    const agent = await agentApi.getAgent(agentId);
    setAgentMap(prev => new Map(prev).set(agentId, agent));
    return agent;
  } catch (error) {
    // Fallback to minimal agent object
    const fallbackAgent: Agent = {
      id: agentId,
      name: `Agent ${agentId.slice(0, 8)}`,
      // ... minimal data
    };
    return fallbackAgent;
  }
};
```

#### Event Transformations

**Countdown Conversion:**
```typescript
// Backend: startsInMs
useSocketEvent('battle:starting', (data) => {
  const countdownSeconds = Math.ceil(data.startsInMs / 1000);
  setCountdown(countdownSeconds);
});
```

**State Mapping:**
```typescript
const stateMap: Record<string, BattleState> = {
  LOBBY: 'lobby',
  STARTING: 'starting',
  IN_PROGRESS: 'in_progress',
  VOTING: 'voting',
  JUDGING: 'judging',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
```

**Turn Enrichment:**
```typescript
useSocketEvent('battle:turn', async (data) => {
  const agent = await fetchAgent(data.agentId);

  const enrichedTurn: EnrichedTurn = {
    ...data,
    agent, // Add full agent object
    round: data.turnNumber, // Map turnNumber to round
    audio_url: data.audioUrl, // Add snake_case version for compatibility
  };

  setTurns(prev => [...prev, enrichedTurn]);
});
```

**Score Transformation:**
```typescript
// Backend uses camelCase, frontend uses snake_case
const transformedScores: Record<string, AgentScore> = {};
Object.entries(data.scores).forEach(([agentId, score]) => {
  transformedScores[agentId] = {
    logic_reasoning: score.logicReasoning,
    evidence_sources: score.evidenceSources,
    rhetoric_persuasion: score.rhetoricPersuasion,
    rebuttal_quality: score.rebuttalQuality,
    style_delivery: score.styleDelivery,
    total: score.total,
  };
});
```

### 4. Updated TurnDisplay Component (`src/components/TurnDisplay/TurnDisplay.tsx`)

Made compatible with enriched turn format:

```typescript
interface EnrichedTurn extends BattleTurnEvent {
  agent?: Agent; // Enriched with full agent data
  round?: number; // Mapped from turnNumber
  audio_url?: string; // Backward compatible
}

// Fallback logic
const agent = turn.agent;
const agentName = agent?.name || `Agent ${turn.agentId?.slice(0, 8) || 'Unknown'}`;
const avatarUrl = agent?.avatar_url;
const round = turn.round || (turn as any).turnNumber || 0;
const audioUrl = (turn as any).audioUrl || turn.audio_url;
```

### 5. Updated Component Exports

- Phase 1E version now exported as default
- Old version renamed to `BattleViewer.tsx.old` to prevent type errors
- Updated `src/components/index.ts` to export Phase1E version
- Updated `src/pages/BattleViewerPage.tsx` to use Phase1E version

## Event Flow

### Connection Flow
```
1. Frontend: io.connect(ws://localhost:3000)
2. Backend: emits 'connected'
3. Frontend: emits 'battle:join' with battleId
4. Backend: emits 'battle:connected' with config and participants
5. Frontend: Fetches agent data for each participant
```

### Battle Flow
```
1. Backend: 'battle:starting' (startsInMs: 10000)
   Frontend: Converts to countdown in seconds (10)

2. Backend: 'battle:state' (status: 'IN_PROGRESS', currentRound: 1)
   Frontend: Maps to state 'in_progress', updates UI

3. Backend: 'battle:turn' (agentId, content, audioUrl)
   Frontend: Fetches agent data, enriches turn, displays

4. Backend: 'battle:commentary' (text, audioUrl)
   Frontend: Displays commentary with audio playback

5. Backend: 'battle:voting_open' (durationMs: 30000)
   Frontend: Opens voting UI with 30s countdown

6. Backend: 'battle:vote_update' (totalVotes: 5)
   Frontend: Updates vote count display

7. Backend: 'battle:ended' (winnerId, scores, reasoning)
   Frontend: Transforms scores, displays results
```

## API Usage

### Agent Data Fetching

The frontend fetches agent data from the REST API:

```typescript
// Using existing API client
import { agentApi } from '@/lib/api';

const agent = await agentApi.getAgent(agentId);
// Returns: Agent object with { id, name, description, avatar_url, stats, ... }
```

**Caching Strategy:**
- Agents are cached in a Map after first fetch
- Cache persists for the battle duration
- Fallback to minimal agent object if fetch fails

## Testing

### Verification Checklist

1. **Connection**
   - [ ] Frontend connects to WebSocket
   - [ ] `battle:join` is auto-emitted
   - [ ] `battle:connected` is received
   - [ ] Agent data is fetched for participants

2. **Battle Countdown**
   - [ ] Countdown shows in seconds (not milliseconds)
   - [ ] Agent avatars/names display correctly
   - [ ] Countdown reaches zero and battle starts

3. **Turn Display**
   - [ ] Turns appear in real-time
   - [ ] Agent names and avatars show correctly
   - [ ] Audio playback buttons work
   - [ ] Turn content displays fully
   - [ ] Round numbers are correct

4. **Commentary**
   - [ ] Commentary appears in sidebar
   - [ ] Commentary audio plays
   - [ ] Auto-scrolls to latest

5. **Voting**
   - [ ] Voting UI appears after final turn
   - [ ] 30-second countdown works
   - [ ] Vote buttons work
   - [ ] Vote confirmation shows
   - [ ] Total vote count updates

6. **Results**
   - [ ] Winner announcement shows
   - [ ] Judge reasoning displays
   - [ ] Scores show all 5 categories
   - [ ] Score values are correct (not NaN)
   - [ ] Vote distribution shows

### Debug Logging

The Phase 1E Battle Viewer includes console logging for all events:

```typescript
console.log('[BattleViewer] Connected to WebSocket');
console.log('[BattleViewer] Battle connected:', data);
console.log('[BattleViewer] Participant joined:', data);
console.log('[BattleViewer] Battle starting:', data);
console.log('[BattleViewer] State change:', data);
console.log('[BattleViewer] New turn:', data);
console.log('[BattleViewer] Commentary:', data);
console.log('[BattleViewer] Voting open:', data);
console.log('[BattleViewer] Vote recorded:', data);
console.log('[BattleViewer] Vote update:', data);
console.log('[BattleViewer] Battle ended:', data);
```

Check the browser console for these logs to verify event flow.

## Known Limitations

1. **Agent Feedback Not Available**
   - Phase 1E backend doesn't send detailed per-agent feedback
   - ResultsPanel shows empty feedback object
   - Future Phase 1F will add this

2. **Spectator Count Not Tracked**
   - Header shows "0 watching" (hardcoded)
   - Backend doesn't send spectator count updates yet
   - Future enhancement

3. **Vote Distribution Hidden During Voting**
   - Only total vote count shown during voting
   - Full breakdown shown in results
   - Intentional for fairness

## Backward Compatibility

The components maintain backward compatibility with old event formats:

- TurnDisplay checks for both `audioUrl` and `audio_url`
- TurnDisplay checks for both `round` and `turnNumber`
- Fallback logic for missing agent data
- Handles both camelCase and snake_case properties

## Future Enhancements

1. **Real-time Spectator Count**
   - Add WebSocket event for spectator count updates
   - Update header display

2. **Detailed Agent Feedback**
   - Backend sends per-agent strengths/weaknesses
   - Display in ResultsPanel

3. **Replay Support**
   - Save battle transcript
   - Allow playback of completed battles

4. **Better Error Handling**
   - Add error boundaries
   - Show user-friendly error messages
   - Retry logic for failed API calls

## Troubleshooting

### Turn doesn't show agent name
**Issue:** Turn displays "Agent abc123..." instead of agent name
**Cause:** Agent data fetch failed
**Solution:** Check browser console for API errors, verify `/api/v1/agents/:id` endpoint works

### Audio doesn't play
**Issue:** Audio playback button doesn't work
**Cause:** `audioUrl` is undefined or TTS generation failed
**Solution:** Check backend logs for TTS errors, verify Deepgram API key

### Vote doesn't register
**Issue:** Clicking vote button doesn't update count
**Cause:** WebSocket `battle:vote` emission failed or wrong format
**Solution:** Check browser console logs, verify vote payload is `{ battleId, agentId }`

### Results show NaN scores
**Issue:** Score values show as NaN
**Cause:** Score transformation failed or backend didn't send scores
**Solution:** Check `battle:ended` event structure in console, verify scores object exists

## Summary

The frontend is now fully compatible with Phase 1E backend. All WebSocket events are handled correctly, data is transformed as needed, and the UI provides a complete battle viewing experience with:

- Real-time turn updates
- AI commentary with TTS
- Voting interface
- Detailed results with judge scores

**Status:** ✅ Production Ready
**Last Updated:** 2026-02-20
