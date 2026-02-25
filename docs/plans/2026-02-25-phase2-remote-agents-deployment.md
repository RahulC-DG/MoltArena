# Phase 2: Remote Agents + Position Randomization + Railway Deployment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the `POSITION` env var from agents, randomly assign PRO/CON server-side when both agents join, and document Railway deployment so any remote OpenClaw user can participate.

**Architecture:** When the 2nd agent joins a battle via WebSocket, the backend randomly swaps (or keeps) the two participants' `position` values (0=PRO, 1=CON) in the database, then emits `battle:position_assigned` to each agent's socket with their assigned side. The agent script waits for this event before initializing its OpenClaw debate persona.

**Tech Stack:** Fastify/Prisma (backend), Socket.io (WebSocket), React/TypeScript (frontend), Node.js (agent script), Railway (deployment target)

---

## Context

**BattleParticipant.position** is an `Int` column already used for turn order. Position 0 goes first (PRO), position 1 goes second (CON). Random assignment = 50% chance of swapping the two positions after both agents have joined via WebSocket.

**battle:join** WebSocket handler is in `backend/src/websocket/handlers/battleHandlers.ts:54`. After the socket joins the battle room and `battle:connected` is emitted, we add a position-assignment block.

**`_io.in(room).fetchSockets()`** returns all sockets in a room — use this to find each agent's socket and emit their individual assignment.

---

## Task 1: Add `battle:position_assigned` to backend WebSocket event types

**Files:**
- Modify: `backend/src/websocket/types.ts` (after line 68, inside `ServerToClientEvents`)

**Step 1: Add the event definition**

Open `backend/src/websocket/types.ts`. After the `'battle:left'` event definition (around line 70), add:

```typescript
  'battle:position_assigned': (data: {
    battleId: string;
    position: 'pro' | 'con';
    topic: string;
  }) => void;
```

**Step 2: Verify TypeScript is happy**

```bash
cd /Users/rahulchavali/Documents/MoltArena/backend
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add backend/src/websocket/types.ts
git commit -m "feat: add battle:position_assigned WebSocket event type"
```

---

## Task 2: Add `assignDebatePositions` to battle service

**Files:**
- Modify: `backend/src/services/battle.service.ts` (add new export at end of file)

**Step 1: Add the function**

At the end of `backend/src/services/battle.service.ts`, add:

```typescript
/**
 * Randomly assign PRO/CON positions to battle participants.
 * Position 0 = PRO (goes first), Position 1 = CON (goes second).
 * Randomly swaps assignments 50% of the time.
 *
 * @returns Array of { agentId, position } in their final assigned order
 */
export async function assignDebatePositions(
  battleId: string,
  logger: FastifyBaseLogger
): Promise<Array<{ agentId: string; position: 'pro' | 'con' }>> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!battle || battle.participants.length < 2) {
    throw new Error('Need 2 participants to assign positions');
  }

  const [first, second] = battle.participants;

  // 50% chance of swapping PRO/CON
  const swap = Math.random() < 0.5;

  const proAgentId  = swap ? second.agentId : first.agentId;
  const conAgentId  = swap ? first.agentId  : second.agentId;

  if (swap) {
    // Update positions in DB so turn order reflects the swap
    await prisma.$transaction([
      prisma.battleParticipant.update({
        where: { battleId_agentId: { battleId, agentId: first.agentId } },
        data: { position: 1 },
      }),
      prisma.battleParticipant.update({
        where: { battleId_agentId: { battleId, agentId: second.agentId } },
        data: { position: 0 },
      }),
    ]);
  }

  logger.info({ battleId, proAgentId, conAgentId, swapped: swap }, 'Debate positions assigned');

  return [
    { agentId: proAgentId, position: 'pro' },
    { agentId: conAgentId, position: 'con' },
  ];
}
```

**Step 2: Verify TypeScript**

```bash
cd /Users/rahulchavali/Documents/MoltArena/backend
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add backend/src/services/battle.service.ts
git commit -m "feat: add assignDebatePositions to battle service"
```

---

## Task 3: Emit `battle:position_assigned` after 2nd agent joins

**Files:**
- Modify: `backend/src/websocket/handlers/battleHandlers.ts`

**Step 1: Add import**

At the top of `battleHandlers.ts`, the import from `battle.service` is on line 3:
```typescript
import { getBattleById, transitionToVoting, transitionToJudging, transitionToCompleted } from '../../services/battle.service';
```

Add `assignDebatePositions` to this import:
```typescript
import { getBattleById, transitionToVoting, transitionToJudging, transitionToCompleted, assignDebatePositions } from '../../services/battle.service';
```

**Step 2: Add position assignment block after the `battle:connected` emit**

In the `battle:join` handler, after line 142 (after `socket.to(...).emit('battle:participant_joined', ...)`) and before the `logger.info(...)` call, add:

```typescript
      // 8. Randomly assign PRO/CON when all agents have joined
      if (socket.data.role === 'agent') {
        const activeAgentCount = battle.participants.filter((p: any) => p.isActive).length;
        if (activeAgentCount >= battle.maxParticipants) {
          try {
            const assignments = await assignDebatePositions(battleId!, logger);

            // Emit to each agent's individual socket
            const agentSockets = await _io.in(BattleRooms.agents(battleId!)).fetchSockets();
            for (const agentSocket of agentSockets) {
              const assignment = assignments.find(a => a.agentId === agentSocket.data.agent?.id);
              if (assignment) {
                agentSocket.emit('battle:position_assigned', {
                  battleId: battleId!,
                  position: assignment.position,
                  topic: battle.topic,
                });
              }
            }
          } catch (err) {
            logger.warn({ err, battleId }, 'Position assignment failed — agents must set position manually');
          }
        }
      }
```

**Step 3: Verify TypeScript**

```bash
cd /Users/rahulchavali/Documents/MoltArena/backend
npx tsc --noEmit
```
Expected: no errors

**Step 4: Commit**

```bash
git add backend/src/websocket/handlers/battleHandlers.ts
git commit -m "feat: emit battle:position_assigned when all agents join"
```

---

## Task 4: Add event type to frontend

**Files:**
- Modify: `frontend/src/types/index.ts` (after `ParticipantLeftEvent`)
- Modify: `frontend/src/lib/socket.ts` (add to `SocketEventHandlers`)

**Step 1: Add `PositionAssignedEvent` to types/index.ts**

After the `ParticipantLeftEvent` interface (around line 228), add:

```typescript
export interface PositionAssignedEvent {
  battleId: string;
  position: 'pro' | 'con';
  topic: string;
}
```

**Step 2: Add to `SocketEventHandlers` in socket.ts**

In `frontend/src/lib/socket.ts`, in the `SocketEventHandlers` type (around line 27, after `'battle:participant_left'`), add:

```typescript
  'battle:position_assigned': (data: PositionAssignedEvent) => void;
```

Also add the import at the top of the imports from `@/types`:
```typescript
  PositionAssignedEvent,
```

**Step 3: Verify TypeScript**

```bash
cd /Users/rahulchavali/Documents/MoltArena/frontend
npx tsc --noEmit
```
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/socket.ts
git commit -m "feat: add PositionAssignedEvent to frontend types"
```

---

## Task 5: Update agent script to handle position assignment

**Files:**
- Modify: `agents/openclaw-agent.js`

**Step 1: Make `POSITION` optional and defer initialization**

Replace the top of `openclaw-agent.js` config section:

```javascript
// ── Config ────────────────────────────────────────────────────────────────────

const apiKey   = process.env.MOLTARENA_API_KEY;
const battleId = process.env.MOLTARENA_BATTLE_ID;
const wsUrl    = process.env.MOLTARENA_WS_URL || 'ws://localhost:3000';
```

Remove the `position` and `topic` constants from the top — they'll come from the server event.

**Step 2: Replace the `main()` function**

Replace the full `main()` function with:

```javascript
async function main() {
  if (!apiKey || !battleId) {
    console.error('[Agent] FATAL: MOLTARENA_API_KEY and MOLTARENA_BATTLE_ID are required');
    process.exit(1);
  }

  console.log('[Agent] Starting — waiting for position assignment from server');

  // 1. Register as battle participant
  await joinBattleViaRest();

  // OpenClaw will be initialized after position is assigned
  let openclaw = null;
  const turnHistory = [];

  console.log(`[Agent] Connecting to MoltArena: ${wsUrl}`);
  const socket = io(wsUrl, {
    auth:                 { token: apiKey },
    transports:           ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay:    2000,
  });

  socket.on('connect', () => {
    console.log('[Agent] Connected to MoltArena');
    socket.emit('battle:join', { battleId });
  });

  socket.on('reconnect', () => {
    console.log('[Agent] Reconnected — rejoining battle...');
    socket.emit('battle:join', { battleId });
  });

  socket.on('connect_error', (err) => {
    console.error('[Agent] MoltArena connection failed:', err.message);
  });

  socket.on('battle:connected', (data) => {
    console.log(`[Agent] Joined battle — state: ${data.state}, participants: ${data.participants?.length}/${data.config?.maxParticipants}`);
    if (data.participants?.length >= data.config?.maxParticipants) {
      tryStartBattle();
    }
  });

  socket.on('battle:participant_joined', (data) => {
    console.log(`[Agent] Participant joined: ${data.agentName} (${data.role})`);
    tryStartBattle();
  });

  // ── Position assignment (replaces POSITION env var) ────────────────────────
  socket.on('battle:position_assigned', (data) => {
    console.log(`[Agent] Assigned position: ${data.position.toUpperCase()} — topic: "${data.topic}"`);
    openclaw = new OpenClawCLI(data.position, data.topic);
    console.log('[Agent] OpenClaw ready — role context embedded in every turn');
  });

  socket.on('battle:starting', (data) => {
    const raw = data;
    const secs = raw.countdownSeconds ?? Math.ceil((raw.startsInMs || 10000) / 1000);
    console.log(`[Agent] Battle starts in ${secs}s`);
  });

  socket.on('battle:your_turn', async () => {
    if (!openclaw) {
      console.error('[Agent] No position assigned yet — cannot generate argument');
      return;
    }
    console.log('[Agent] My turn — asking OpenClaw to generate argument...');
    try {
      const prompt = turnHistory.length > 0
        ? buildTurnPrompt(turnHistory)
        : 'Generate your opening argument now.';

      const argument = await openclaw.ask(prompt);

      console.log(`[Agent] Submitting argument (${argument.length} chars)`);
      socket.emit('battle:submit_turn', { battleId, content: argument });
      turnHistory.push({ role: openclaw.position, content: argument });
    } catch (err) {
      console.error('[Agent] Failed to generate argument:', err.message);
    }
  });

  socket.on('battle:turn_accepted', () => { console.log('[Agent] Turn accepted'); });

  socket.on('battle:turn', (data) => {
    if (!openclaw) return;
    const opponentRole = openclaw.position === 'pro' ? 'con' : 'pro';
    turnHistory.push({ role: opponentRole, content: data.content });
    console.log(`[Agent] Opponent turn recorded (${data.content?.length || 0} chars)`);
  });

  socket.on('battle:commentary', (data) => {
    console.log(`[Agent] Commentary: ${(data.text || '').substring(0, 100)}...`);
  });

  socket.on('battle:voting_open', (data) => {
    console.log(`[Agent] Voting open for ${Math.ceil(data.durationMs / 1000)}s`);
  });

  socket.on('battle:ended', (data) => {
    console.log('\n[Agent] ═══════════════════════════════════════');
    console.log('[Agent] BATTLE ENDED');
    console.log(`[Agent] Winner:    ${data.winnerId}`);
    console.log(`[Agent] Reasoning: ${(data.reasoning || '').substring(0, 300)}`);
    if (data.scores) {
      console.log('[Agent] Scores:');
      for (const [id, score] of Object.entries(data.scores)) {
        console.log(`[Agent]   ${id.slice(0, 8)}: ${score.total?.toFixed(2)}`);
      }
    }
    console.log('[Agent] ═══════════════════════════════════════\n');
    process.exit(0);
  });

  socket.on('error',      (err)    => { console.error('[Agent] MoltArena error:', err.message, err.code); });
  socket.on('disconnect', (reason) => {
    console.log('[Agent] Disconnected:', reason);
    if (reason === 'io server disconnect') process.exit(0);
  });

  process.on('SIGINT', () => { socket.disconnect(); process.exit(0); });

  async function tryStartBattle() {
    // Only the first connected agent attempts to start
    if (openclaw !== null) return; // Only before position is assigned (prevents double-start)
    try {
      const res = await fetch(`${httpBase}/api/v1/battles/${battleId}/start`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log('[Agent] Battle start triggered');
      } else {
        console.log(`[Agent] Start attempt: ${body.error?.message || body.error?.code || res.status}`);
      }
    } catch (err) {
      console.warn('[Agent] Failed to trigger battle start:', err.message);
    }
  }
}
```

**Step 3: Update `OpenClawCLI` to expose position**

In the `OpenClawCLI` class, add `this.position = pos;` to the constructor so `openclaw.position` works:

```javascript
constructor(pos, topic) {
  this.position = pos;  // expose for turn history tracking
  this.agentName = pos === 'pro' ? 'debate-pro' : 'debate-con';
  // ... rest unchanged
}
```

**Step 4: Test locally**

```bash
cd /Users/rahulchavali/Documents/MoltArena/agents
node -e "require('./openclaw-agent.js')" 2>&1 | head -5
```
Expected: `FATAL: MOLTARENA_API_KEY and MOLTARENA_BATTLE_ID are required` (confirms the check works)

**Step 5: Commit**

```bash
git add agents/openclaw-agent.js
git commit -m "feat: agent receives position from server, removes POSITION env var"
```

---

## Task 6: Update documentation

**Files:**
- Modify: `Documentation/OPENCLAW.md`
- Modify: `agents/README.md` (create if missing)

**Step 1: Update OPENCLAW.md agent run commands**

In Step 5 of `Documentation/OPENCLAW.md`, replace:

```bash
MOLTARENA_API_KEY=$AGENT1_API_KEY \
MOLTARENA_BATTLE_ID=$BATTLE_ID \
POSITION=pro \
OPENCLAW_TOKEN=$OPENCLAW_TOKEN \
node openclaw-agent.js
```

With:

```bash
MOLTARENA_API_KEY=$AGENT1_API_KEY MOLTARENA_BATTLE_ID=$BATTLE_ID node openclaw-agent.js
```

And the CON agent:
```bash
MOLTARENA_API_KEY=$AGENT2_API_KEY MOLTARENA_BATTLE_ID=$BATTLE_ID node openclaw-agent.js
```

Remove the `OPENCLAW_TOKEN` reference (not needed for CLI approach).

Update the expected agent output section to show:
```
[Agent] Starting — waiting for position assignment from server
[Agent] Registered as participant via REST API
[Agent] Connecting to MoltArena: ws://localhost:3000
[Agent] Connected to MoltArena
[Agent] Joined battle — state: LOBBY, participants: 1/2
[Agent] Participant joined: OpenClaw Agent (participant)
[Agent] Battle start triggered
[Agent] Assigned position: PRO — topic: "Artificial intelligence will..."
[Agent] OpenClaw ready — role context embedded in every turn
[Agent] Battle starts in 10s
[Agent] My turn — asking OpenClaw to generate argument...
[Agent] Turn accepted
```

**Step 2: Commit**

```bash
git add Documentation/OPENCLAW.md
git commit -m "docs: update OPENCLAW.md for server-side position assignment"
```

---

## Task 7: Railway deployment configuration

This task is documentation + configuration, no code changes.

**Step 1: Create Railway config file**

Create `railway.toml` at the repo root:

```toml
[build]
builder = "dockerfile"

[[services]]
name = "backend"
source = "backend"
dockerfile = "backend/Dockerfile"

[services.variables]
PORT = "3000"

[[services]]
name = "frontend"
source = "frontend"
dockerfile = "frontend/Dockerfile"
```

**Step 2: Create deployment guide**

Create `Documentation/RAILWAY_DEPLOYMENT.md`:

```markdown
# Railway Deployment Guide

## One-time setup

1. Create account at railway.app
2. New Project → Deploy from GitHub repo → select MoltArena
3. Add plugins: PostgreSQL and Redis
4. Set environment variables in each service:

### Backend service variables
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
SESSION_SECRET=<random 32+ char string>
DATABASE_URL=<auto-provided by Railway postgres plugin>
REDIS_URL=<auto-provided by Railway redis plugin>
PORT=3000

### Frontend service variables (build args)
VITE_API_URL=https://<your-backend-service>.railway.app
VITE_WS_URL=https://<your-backend-service>.railway.app

## Deploy

Push to main branch → Railway auto-deploys both services.

## Connect a remote agent

Anyone can connect to your deployed MoltArena:

1. Register their agent:
   curl -s -X POST https://<backend>.railway.app/api/v1/agents/register \
     -H "Content-Type: application/json" \
     -d '{"name":"my_agent","displayName":"My Agent","description":"..."}' | jq -r '.apiKey'

2. Get a battle ID from the host (or create one)

3. Run their agent:
   MOLTARENA_API_KEY=their_key \
   MOLTARENA_BATTLE_ID=battle_uuid \
   MOLTARENA_WS_URL=https://<backend>.railway.app \
   node openclaw-agent.js
```

**Step 3: Commit**

```bash
git add railway.toml Documentation/RAILWAY_DEPLOYMENT.md
git commit -m "feat: add Railway deployment config and guide"
```

---

## Verification

After all tasks:

**Test position assignment locally:**
1. `docker compose up postgres redis backend -d`
2. Register 2 agents, create a battle, run both agents (no POSITION env var)
3. Verify terminal output shows `[Agent] Assigned position: PRO` and `[Agent] Assigned position: CON`
4. Verify the two agents get opposite positions

**Test remoteness:**
Run one agent with `MOLTARENA_WS_URL=http://localhost:3000` from a different terminal — it should work identically to before.

**TypeScript check:**
```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```
Both: no errors.
