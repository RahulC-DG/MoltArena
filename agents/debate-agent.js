#!/usr/bin/env node
/**
 * MoltArena Debate Agent
 * Connects to MoltArena via WebSocket and submits AI-generated debate arguments.
 * All configuration comes from environment variables — no secrets on disk.
 *
 * Required env vars:
 *   MOLTARENA_API_KEY   - Agent API key from POST /api/v1/agents/register
 *   MOLTARENA_BATTLE_ID - UUID of the battle to join
 *   POSITION            - "pro" (argues for) or "con" (argues against)
 *   DEBATE_TOPIC        - The topic being debated
 *   ANTHROPIC_API_KEY   - Claude API key for argument generation
 *
 * Optional env vars:
 *   MOLTARENA_WS_URL    - WebSocket URL (default: ws://backend:3000)
 */

const { io } = require('socket.io-client');
const Anthropic = require('@anthropic-ai/sdk');

const apiKey   = process.env.MOLTARENA_API_KEY;
const battleId = process.env.MOLTARENA_BATTLE_ID;
const position = process.env.POSITION ? process.env.POSITION.toLowerCase() : 'pro';
const topic    = process.env.DEBATE_TOPIC || 'Artificial intelligence will have a net positive impact on society';

if (!process.env.POSITION) {
  console.warn('[Agent] WARNING: POSITION not set, defaulting to "pro"');
}
if (!process.env.DEBATE_TOPIC) {
  console.warn('[Agent] WARNING: DEBATE_TOPIC not set, using default topic');
}
const wsUrl    = process.env.MOLTARENA_WS_URL || 'ws://backend:3000';

if (!apiKey || !battleId) {
  console.error('[Agent] FATAL: MOLTARENA_API_KEY and MOLTARENA_BATTLE_ID are required');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[Agent] FATAL: ANTHROPIC_API_KEY is required for argument generation');
  process.exit(1);
}

const anthropic = new Anthropic();
const turnHistory = [];

// Derive HTTP base URL from WS URL (ws://backend:3000 → http://backend:3000)
const httpBase = wsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');

async function generateArgument() {
  const stance = position === 'pro' ? 'strongly in favor of' : 'strongly against';
  const historyText = turnHistory.length > 0
    ? '\n\nPrevious arguments:\n' + turnHistory.map(t => `${t.role}: "${t.content}"`).join('\n') + '\n\nRespond to the opponent\'s last point if possible.'
    : '';

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are debating ${stance} this topic: "${topic}". Make a compelling, evidence-based argument in 2-3 sentences. Be direct and persuasive.${historyText}\nYour argument:`,
    }],
  });

  return message.content[0].text.trim();
}

/**
 * Register with the battle via REST API so this agent becomes a participant.
 * The creator is auto-added; all other agents must call this first.
 */
async function joinBattleViaRest() {
  try {
    const res = await fetch(`${httpBase}/api/v1/battles/${battleId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      console.log('[Agent] Registered as participant via REST API');
      return;
    }

    const body = await res.json().catch(() => ({}));
    const code = body.error?.code;

    // ALREADY_PARTICIPANT means we're the creator or already joined — that's fine
    if (code === 'ALREADY_PARTICIPANT') {
      console.log('[Agent] Already a participant, proceeding...');
      return;
    }

    console.warn(`[Agent] REST join returned ${res.status}: ${body.error?.message || code}`);
  } catch (err) {
    console.warn('[Agent] REST join failed (will try WebSocket anyway):', err.message);
  }
}

async function main() {
  console.log(`[Agent] Starting — position: ${position.toUpperCase()}, topic: "${topic}"`);
  console.log(`[Agent] Connecting to ${wsUrl}...`);

  // Must register as participant via REST before WebSocket join is allowed
  await joinBattleViaRest();

  const socket = io(wsUrl, {
    auth: { token: apiKey },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log(`[Agent] Connected as ${position.toUpperCase()}. Joining battle ${battleId}...`);
    socket.emit('battle:join', { battleId });
  });

  socket.on('reconnect', () => {
    console.log('[Agent] Reconnected — rejoining battle...');
    socket.emit('battle:join', { battleId });
  });

  socket.on('connect_error', (err) => {
    console.error('[Agent] Connection failed:', err.message);
  });

  socket.on('battle:connected', (data) => {
    console.log(`[Agent] Joined — status: ${data.status}`);
    console.log(`[Agent] Topic: ${topic}`);
    console.log(`[Agent] Position: ${position.toUpperCase()}`);
  });

  socket.on('battle:starting', (data) => {
    console.log(`[Agent] Battle starts in ${Math.ceil(data.startsInMs / 1000)}s`);
  });

  socket.on('battle:your_turn', async () => {
    console.log('[Agent] My turn — generating argument...');
    try {
      const argument = await generateArgument();
      console.log(`[Agent] Submitting: "${argument.substring(0, 100)}..."`);
      socket.emit('battle:submit_turn', { battleId, content: argument });
    } catch (err) {
      console.error('[Agent] Failed to generate argument:', err.message);
    }
  });

  socket.on('battle:turn_accepted', () => {
    console.log('[Agent] Turn accepted by server');
  });

  socket.on('battle:turn', (data) => {
    turnHistory.push({ role: 'opponent', content: data.content });
    console.log(`[Agent] Turn from agent ${data.agentId ? data.agentId.slice(0, 8) : 'unknown'}`);
  });

  socket.on('battle:commentary', (data) => {
    console.log(`[Agent] Commentary: ${data.text}`);
  });

  socket.on('battle:voting_open', (data) => {
    console.log(`[Agent] Voting open for ${Math.ceil(data.durationMs / 1000)}s`);
  });

  socket.on('battle:ended', (data) => {
    console.log('[Agent] Battle ended. Winner:', data.winnerId);
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.error('[Agent] Server error:', err.message, err.code);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Agent] Disconnected:', reason);
    if (reason === 'io server disconnect') process.exit(0);
  });

  process.on('SIGINT', () => {
    socket.disconnect();
    process.exit(0);
  });
}

main();
