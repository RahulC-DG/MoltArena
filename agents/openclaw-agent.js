#!/usr/bin/env node
/**
 * MoltArena OpenClaw Bridge Agent
 *
 * Routes debate argument generation through the `openclaw agent` CLI.
 * Each position (PRO/CON) maintains its own OpenClaw session for memory continuity.
 * Uses the CLI subprocess — avoids gateway WebSocket scope issues entirely.
 *
 * Run:
 *   MOLTARENA_API_KEY=... MOLTARENA_BATTLE_ID=... POSITION=pro node openclaw-agent.js
 *
 * Required env vars:
 *   MOLTARENA_API_KEY   - Agent API key from POST /api/v1/agents/register
 *   MOLTARENA_BATTLE_ID - UUID of the battle to join
 *   POSITION            - "pro" or "con"
 *
 * Optional env vars:
 *   DEBATE_TOPIC        - The topic being debated
 *   MOLTARENA_WS_URL    - MoltArena WebSocket URL (default: ws://localhost:3000)
 */

const { io }    = require('socket.io-client');
const { spawn } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const apiKey   = process.env.MOLTARENA_API_KEY;
const battleId = process.env.MOLTARENA_BATTLE_ID;
const position = (process.env.POSITION || 'pro').toLowerCase();
const topic    = process.env.DEBATE_TOPIC || 'Artificial intelligence will have a net positive impact on society';
const wsUrl    = process.env.MOLTARENA_WS_URL || 'ws://localhost:3000';

if (!apiKey || !battleId) {
  console.error('[Agent] FATAL: MOLTARENA_API_KEY and MOLTARENA_BATTLE_ID are required');
  process.exit(1);
}

const httpBase = wsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');

// ── OpenClaw CLI wrapper ───────────────────────────────────────────────────────

class OpenClawCLI {
  /**
   * Stateless per-call wrapper — embeds the debate persona context in every
   * message so PRO and CON never pollute each other's session memory.
   *
   * @param {string} pos   - 'pro' or 'con'
   * @param {string} topic - debate topic
   */
  constructor(pos, topic) {
    this.agentName = pos === 'pro' ? 'debate-pro' : 'debate-con';
    const side = pos === 'pro' ? 'STRONGLY IN FAVOR OF' : 'STRONGLY AGAINST';
    this.prefix = [
      `You are a skilled competitive debater. Your position is ${side} this topic: "${topic}".`,
      `You must hold the ${pos.toUpperCase()} position exclusively.`,
      `Respond with compelling, evidence-based arguments of 2–4 sentences.`,
      `When the opponent has spoken, acknowledge their key point before rebutting it.`,
      `Never concede the debate.\n`,
    ].join(' ');
  }

  ask(message, timeoutMs = 60000) {
    // Prepend the role context so every call is self-contained
    const fullMessage = this.prefix + message;
    return new Promise((resolve, reject) => {
      const args = ['agent', '--agent', this.agentName, '--message', fullMessage, '--json'];

      console.log(`[OpenClaw] openclaw agent --agent ${this.agentName} --message "${message.substring(0, 60)}..."`);

      const proc  = spawn('openclaw', args, { env: process.env });
      let stdout  = '';
      let stderr  = '';

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('OpenClaw CLI timeout'));
      }, timeoutMs);

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`openclaw CLI spawn error: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          console.error(`[OpenClaw] CLI exited ${code}: ${stderr.trim().substring(0, 300)}`);
          reject(new Error(`openclaw agent failed (exit ${code})`));
          return;
        }

        // Parse response — try JSON first, fall back to raw text
        // Gateway mode: { result: { payloads: [{text}] } }
        // Local mode:   { payloads: [{text}] }
        let text = '';
        try {
          const json = JSON.parse(stdout.trim());
          text = json.result?.payloads?.[0]?.text
              ?? json.payloads?.[0]?.text
              ?? json.text ?? json.response ?? json.message
              ?? json.content ?? json.output ?? '';
        } catch {
          // Not JSON — use raw stdout
          text = stdout.trim();
        }

        if (!text) {
          // Log raw output to help debug unknown response format
          console.error(`[OpenClaw] Empty response. Raw stdout: ${stdout.substring(0, 300)}`);
          reject(new Error('OpenClaw returned empty response'));
          return;
        }

        console.log(`[OpenClaw] Generated (${text.length} chars): "${text.substring(0, 80)}..."`);
        resolve(text);
      });
    });
  }
}

// ── REST: join as battle participant ──────────────────────────────────────────

async function joinBattleViaRest() {
  try {
    const res = await fetch(`${httpBase}/api/v1/battles/${battleId}/join`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body:    JSON.stringify({}),
    });

    if (res.ok) { console.log('[Agent] Registered as participant via REST API'); return; }

    const body = await res.json().catch(() => ({}));
    if (body.error?.code === 'ALREADY_PARTICIPANT') {
      console.log('[Agent] Already a participant, continuing...');
    } else {
      console.warn(`[Agent] REST join ${res.status}: ${body.error?.message || body.error?.code}`);
    }
  } catch (err) {
    console.warn('[Agent] REST join failed (will try WebSocket anyway):', err.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Agent] Starting — position: ${position.toUpperCase()}, topic: "${topic}"`);

  // 1. Register as battle participant
  await joinBattleViaRest();

  // 2. Initialize OpenClaw CLI (persona context embedded in every call)
  const openclaw = new OpenClawCLI(position, topic);
  console.log(`[Agent] OpenClaw ready — role context embedded in every turn`);

  // 3. Connect to MoltArena and run the debate
  const turnHistory = [];

  console.log(`[Agent] Connecting to MoltArena: ${wsUrl}`);
  const socket = io(wsUrl, {
    auth:                 { token: apiKey },
    transports:           ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay:    2000,
  });

  socket.on('connect', () => {
    console.log(`[Agent] Connected to MoltArena as ${position.toUpperCase()}`);
    socket.emit('battle:join', { battleId });
  });

  socket.on('reconnect', () => {
    console.log('[Agent] Reconnected — rejoining battle...');
    socket.emit('battle:join', { battleId });
  });

  socket.on('connect_error', (err) => {
    console.error('[Agent] MoltArena connection failed:', err.message);
  });

  async function tryStartBattle() {
    if (position !== 'pro') return; // only host starts
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

  socket.on('battle:connected', (data) => {
    console.log(`[Agent] Joined battle — state: ${data.state}, participants: ${data.participants?.length}/${data.config?.maxParticipants}`);
    // Auto-start if already full (e.g. reconnect scenario)
    if (data.participants?.length >= data.config?.maxParticipants) {
      tryStartBattle();
    }
  });

  socket.on('battle:participant_joined', (data) => {
    console.log(`[Agent] Participant joined: ${data.agentName} (${data.role})`);
    tryStartBattle(); // PRO tries to start; silently fails if not enough participants yet
  });

  socket.on('battle:starting', (data) => {
    console.log(`[Agent] Battle starts in ${Math.ceil(data.startsInMs / 1000)}s`);
  });

  socket.on('battle:your_turn', async () => {
    console.log('[Agent] My turn — asking OpenClaw to generate argument...');
    try {
      const prompt = turnHistory.length > 0
        ? buildTurnPrompt(turnHistory)
        : 'Generate your opening argument now.';

      const argument = await openclaw.ask(prompt);

      console.log(`[Agent] Submitting argument (${argument.length} chars)`);
      socket.emit('battle:submit_turn', { battleId, content: argument });
      turnHistory.push({ role: position, content: argument });
    } catch (err) {
      console.error('[Agent] Failed to generate argument:', err.message);
    }
  });

  socket.on('battle:turn_accepted', () => { console.log('[Agent] Turn accepted'); });

  socket.on('battle:turn', (data) => {
    const opponentRole = position === 'pro' ? 'con' : 'pro';
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
}

function buildTurnPrompt(history) {
  const lines = history.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join('\n\n');
  return (
    `Debate history so far:\n\n${lines}\n\n` +
    `Generate your next argument. Directly address the opponent's last point, ` +
    `then advance your own position with a new piece of evidence or reasoning.`
  );
}

main().catch((err) => {
  console.error('[Agent] Fatal error:', err.message);
  process.exit(1);
});
