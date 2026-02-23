#!/usr/bin/env node
/**
 * MoltArena OpenClaw Bridge Agent
 *
 * Routes debate argument generation through a running OpenClaw instance.
 * Each agent position (PRO/CON) is a separate named session on the same
 * OpenClaw daemon, giving it its own conversation memory and debate context.
 *
 * Required env vars:
 *   MOLTARENA_API_KEY      - Agent API key from POST /api/v1/agents/register
 *   MOLTARENA_BATTLE_ID    - UUID of the battle to join
 *   OPENCLAW_TOKEN         - Bearer token for OpenClaw gateway authentication
 *   POSITION               - "pro" or "con"
 *   DEBATE_TOPIC           - The topic being debated
 *
 * Optional env vars:
 *   MOLTARENA_WS_URL       - MoltArena WebSocket URL (default: ws://backend:3000)
 *   OPENCLAW_GATEWAY_URL   - OpenClaw gateway URL (default: ws://host.docker.internal:18789)
 */

const { io } = require('socket.io-client');
const WebSocket = require('ws');

// ── Config ────────────────────────────────────────────────────────────────────

const apiKey      = process.env.MOLTARENA_API_KEY;
const battleId    = process.env.MOLTARENA_BATTLE_ID;
const position    = (process.env.POSITION || 'pro').toLowerCase();
const topic       = process.env.DEBATE_TOPIC || 'Artificial intelligence will have a net positive impact on society';
const wsUrl       = process.env.MOLTARENA_WS_URL    || 'ws://backend:3000';
const gatewayUrl  = process.env.OPENCLAW_GATEWAY_URL || 'ws://host.docker.internal:18789';
const gatewayToken = process.env.OPENCLAW_TOKEN;

if (!apiKey || !battleId) {
  console.error('[Agent] FATAL: MOLTARENA_API_KEY and MOLTARENA_BATTLE_ID are required');
  process.exit(1);
}
if (!gatewayToken) {
  console.error('[Agent] FATAL: OPENCLAW_TOKEN is required (see Documentation/OPENCLAW.md Step 1)');
  process.exit(1);
}

const sessionKey = `moltarena-${battleId}-${position}`;
const httpBase   = wsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');

// ── OpenClaw Gateway Client ────────────────────────────────────────────────────

class OpenClawGateway {
  constructor(url, token) {
    this.url   = url;
    this.token = token;
    this.ws    = null;
    this.ready = false;
    this.reqId = 0;
    this.pending       = new Map(); // id → { resolve, reject }
    this.turnListeners = new Map(); // runId → { text, resolve, reject }
    this._connectResolve = null;
    this._connectReject  = null;
    this._connectTimeout = null;
  }

  nextId() { return `r${++this.reqId}`; }

  connect() {
    return new Promise((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject  = reject;
      this._connectTimeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout after 15s'));
      }, 15000);

      this.ws = new WebSocket(this.url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      this.ws.on('open', () => {
        console.log('[Gateway] WebSocket open, waiting for challenge...');
      });

      this.ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        this._handle(msg);
      });

      this.ws.on('error', (err) => {
        if (!this.ready && this._connectReject) {
          clearTimeout(this._connectTimeout);
          this._connectReject(err);
          this._connectResolve = null;
          this._connectReject  = null;
        }
      });

      this.ws.on('close', () => {
        this.ready = false;
        console.log('[Gateway] Connection closed');
      });
    });
  }

  _handle(msg) {
    // ── Handshake phase ────────────────────────────────────────────────────
    if (!this.ready) {
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        console.log('[Gateway] Received challenge, authenticating...');
        this._send({
          type:   'req',
          id:     this.nextId(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id:       'moltarena-bridge',
              version:  '1.0.0',
              platform: 'node',
              mode:     'operator',
            },
            role:   'operator',
            scopes: ['operator.read', 'operator.write'],
            auth:   { token: this.token },
          },
        });
      } else if (msg.type === 'res' && msg.payload?.type === 'hello-ok') {
        this.ready = true;
        clearTimeout(this._connectTimeout);
        console.log('[Gateway] Connected and authenticated');
        this._connectResolve(this);
        this._connectResolve = null;
        this._connectReject  = null;
        this._connectTimeout = null;
      }
      return;
    }

    // ── Responses to RPC requests ──────────────────────────────────────────
    if (msg.type === 'res' && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.ok) resolve(msg.payload);
      else reject(new Error(msg.error?.message || 'Gateway request failed'));
      return;
    }

    // ── Streaming agent output ─────────────────────────────────────────────
    if (msg.type === 'event' && msg.event === 'chat') {
      const { runId, stream, type: evType, content } = msg.payload || {};
      const listener = this.turnListeners.get(runId);
      if (!listener) return;

      if (stream === 'assistant' && evType === 'delta') {
        listener.text += content || '';
      } else if (stream === 'lifecycle' && evType === 'end') {
        this.turnListeners.delete(runId);
        listener.resolve(listener.text.trim());
      } else if (stream === 'lifecycle' && evType === 'error') {
        this.turnListeners.delete(runId);
        listener.reject(new Error('OpenClaw agent run failed'));
      }
    }
  }

  _send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  _rpc(method, params, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const id = this.nextId();
      const t  = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway RPC timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(t); resolve(v); },
        reject:  (e) => { clearTimeout(t); reject(e); },
      });
      this._send({ type: 'req', id, method, params });
    });
  }

  /**
   * Send a message to the OpenClaw agent session and wait for the full response.
   * Uses agent.request to start a run, then listens for streaming events.
   */
  async ask(message, timeoutMs = 55000) {
    const result = await this._rpc('agent.request', {
      message,
      sessionKey:     this.sessionKey,
      deliver:        false,
      timeoutSeconds: Math.floor(timeoutMs / 1000),
    });

    const { runId } = result;
    console.log(`[Gateway] Agent run started: ${runId}`);

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.turnListeners.delete(runId);
        reject(new Error('OpenClaw response timeout'));
      }, timeoutMs);

      this.turnListeners.set(runId, {
        text:    '',
        resolve: (text) => { clearTimeout(t); resolve(text); },
        reject:  (err)  => { clearTimeout(t); reject(err);   },
      });
    });
  }
}

// ── REST: register as battle participant ───────────────────────────────────────

async function joinBattleViaRest() {
  try {
    const res = await fetch(`${httpBase}/api/v1/battles/${battleId}/join`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      console.log('[Agent] Registered as participant via REST API');
      return;
    }

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
  console.log(`[Agent] OpenClaw session key: ${sessionKey}`);

  // 1. Register as participant before WebSocket join
  await joinBattleViaRest();

  // 2. Connect to OpenClaw gateway
  console.log(`[Agent] Connecting to OpenClaw gateway: ${gatewayUrl}`);
  const gateway = new OpenClawGateway(gatewayUrl, gatewayToken);
  gateway.sessionKey = sessionKey;
  await gateway.connect();

  // 3. Prime the debate persona for this session
  const side    = position === 'pro' ? 'STRONGLY IN FAVOR OF' : 'STRONGLY AGAINST';
  const initMsg = [
    `You are a skilled competitive debater. Your position is ${side} this topic: "${topic}".`,
    `You must hold the ${position.toUpperCase()} position exclusively throughout this debate.`,
    `When I ask you to "generate your argument", respond with a compelling, evidence-based`,
    `argument of 2–4 sentences. When the opponent has spoken, acknowledge their key point`,
    `before rebutting it. Never concede the debate. Confirm you understand your role.`,
  ].join(' ');

  console.log('[Agent] Initializing debate persona in OpenClaw...');
  const ack = await gateway.ask(initMsg, 30000);
  console.log(`[Agent] Persona confirmed: "${ack.substring(0, 80)}..."`);

  // 4. Connect to MoltArena and run the debate
  const turnHistory = [];

  console.log(`[Agent] Connecting to MoltArena: ${wsUrl}`);
  const socket = io(wsUrl, {
    auth:               { token: apiKey },
    transports:         ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay:  2000,
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

  socket.on('battle:connected', (data) => {
    console.log(`[Agent] Joined battle — status: ${data.status}`);
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

      const argument = await gateway.ask(prompt);

      if (!argument) throw new Error('OpenClaw returned empty response');

      console.log(`[Agent] OpenClaw generated (${argument.length} chars): "${argument.substring(0, 80)}..."`);
      socket.emit('battle:submit_turn', { battleId, content: argument });
      turnHistory.push({ role: position, content: argument });
    } catch (err) {
      console.error('[Agent] Failed to generate argument:', err.message);
    }
  });

  socket.on('battle:turn_accepted', () => {
    console.log('[Agent] Turn accepted by MoltArena');
  });

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

  socket.on('error', (err) => {
    console.error('[Agent] MoltArena error:', err.message, err.code);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Agent] Disconnected:', reason);
    if (reason === 'io server disconnect') process.exit(0);
  });

  process.on('SIGINT', () => {
    socket.disconnect();
    gateway.ws?.close();
    process.exit(0);
  });
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
