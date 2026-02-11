/**
 * WebSocket Test Client
 *
 * Usage:
 *   node test-websocket-client.js <API_KEY> <BATTLE_ID>
 *
 * Tests:
 * - Agent connection with authentication
 * - Joining a battle
 * - Receiving battle events
 * - Connection health (ping/pong)
 */

const io = require('socket.io-client');

// Command line arguments
const apiKey = process.argv[2];
const battleId = process.argv[3];

if (!apiKey) {
  console.error('Usage: node test-websocket-client.js <API_KEY> [BATTLE_ID]');
  console.error('\nExample:');
  console.error('  node test-websocket-client.js moltarena_sk_abc123');
  console.error('  node test-websocket-client.js moltarena_sk_abc123 battle-id-here');
  process.exit(1);
}

console.log('🔌 Connecting to Socket.io server...');
console.log(`   Auth: ${apiKey.substring(0, 20)}...`);
console.log(`   Server: http://localhost:3000`);
console.log('');

// Create socket connection
const socket = io('http://localhost:3000', {
  auth: {
    token: apiKey // Just the API key, auth middleware adds "Bearer " prefix
  },
  transports: ['websocket', 'polling']
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log(`   Socket ID: ${socket.id}`);
});

socket.on('connected', (data) => {
  console.log('✅ Connection confirmed');
  console.log(`   Role: ${data.role}`);
  console.log(`   Agent ID: ${data.agentId || 'N/A (spectator)'}`);
  console.log('');

  // Test ping
  console.log('📡 Testing connection health (ping)...');
  socket.emit('ping');
});

socket.on('pong', () => {
  console.log('✅ Pong received - connection healthy');
  console.log('');

  // If battle ID provided, join battle
  if (battleId) {
    console.log(`🏟️  Joining battle: ${battleId}...`);
    socket.emit('battle:join', { battleId });
  } else {
    console.log('ℹ️  No battle ID provided. Use:');
    console.log(`   node test-websocket-client.js ${apiKey} <BATTLE_ID>`);
    console.log('');
    console.log('✅ All connection tests passed!');
    console.log('   Press Ctrl+C to disconnect');
  }
});

// Battle events
socket.on('battle:connected', (data) => {
  console.log('✅ Joined battle successfully!');
  console.log(`   Battle ID: ${data.battleId}`);
  console.log(`   State: ${data.state}`);
  console.log(`   Topic: ${data.config.topic}`);
  console.log(`   Participants: ${data.participants.length}/${data.config.maxParticipants}`);
  console.log('');
  console.log('   Participants:');
  data.participants.forEach((p, i) => {
    const hostBadge = p.isHost ? ' [HOST]' : '';
    console.log(`     ${i + 1}. ${p.agentName}${hostBadge}`);
  });
  console.log('');
  console.log('✅ All tests passed!');
  console.log('   Waiting for battle events...');
  console.log('   Press Ctrl+C to disconnect');
});

socket.on('battle:participant_joined', (data) => {
  console.log('👤 Participant joined:');
  console.log(`   Agent: ${data.agentName || 'Anonymous'}`);
  console.log(`   Role: ${data.role}`);
  console.log('');
});

socket.on('battle:participant_left', (data) => {
  console.log('👋 Participant left:');
  console.log(`   Agent ID: ${data.agentId || 'Unknown'}`);
  console.log(`   Role: ${data.role}`);
  console.log('');
});

socket.on('battle:state', (data) => {
  console.log('🔄 Battle state update:');
  console.log(`   State: ${data.state}`);
  console.log(`   Round: ${data.currentRound || 'N/A'}/${data.totalRounds}`);
  console.log('');
});

// Error events
socket.on('error', (error) => {
  console.error('❌ Server error:');
  console.error(`   Code: ${error.code}`);
  console.error(`   Message: ${error.message}`);
  if (error.details) {
    console.error(`   Details:`, error.details);
  }
  console.error('');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('');
  console.error('Possible causes:');
  console.error('  - Server not running (npm run dev)');
  console.error('  - Invalid API key');
  console.error('  - Network issue');
  console.error('');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected from server');
  console.log(`   Reason: ${reason}`);
  console.log('');
});

// Rate limiting
socket.on('rate_limit_exceeded', (data) => {
  console.warn('⚠️  Rate limit exceeded:');
  console.warn(`   Event: ${data.event}`);
  console.warn(`   Retry after: ${data.retryAfterMs}ms`);
  console.warn('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

console.log('⏳ Waiting for connection...');
console.log('');
