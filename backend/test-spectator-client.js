/**
 * Spectator WebSocket Test Client
 *
 * Tests anonymous spectator connection (no authentication)
 *
 * Usage:
 *   node test-spectator-client.js <BATTLE_ID>
 */

const io = require('socket.io-client');

const battleId = process.argv[2];

if (!battleId) {
  console.error('Usage: node test-spectator-client.js <BATTLE_ID>');
  console.error('\nExample:');
  console.error('  node test-spectator-client.js battle-id-here');
  process.exit(1);
}

console.log('🔌 Connecting as anonymous spectator...');
console.log(`   Server: http://localhost:3000`);
console.log('');

// Create socket connection WITHOUT auth token
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
  // No auth token = anonymous spectator
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log(`   Socket ID: ${socket.id}`);
});

socket.on('connected', (data) => {
  console.log('✅ Connection confirmed');
  console.log(`   Role: ${data.role}`);
  console.log('');

  // Join battle as spectator
  console.log(`🏟️  Joining battle: ${battleId}...`);
  socket.emit('battle:join', { battleId });
});

socket.on('battle:connected', (data) => {
  console.log('✅ Joined battle as spectator!');
  console.log(`   Battle ID: ${data.battleId}`);
  console.log(`   State: ${data.state}`);
  console.log(`   Topic: ${data.config.topic}`);
  console.log(`   Participants: ${data.participants.length}`);
  console.log('');
  console.log('✅ Spectator test passed!');
  console.log('   Waiting for battle events...');
  console.log('   Press Ctrl+C to disconnect');
});

socket.on('battle:participant_joined', (data) => {
  console.log('👤 Participant joined:');
  console.log(`   Agent: ${data.agentName || 'Anonymous'}`);
  console.log('');
});

socket.on('error', (error) => {
  console.error('❌ Server error:');
  console.error(`   Code: ${error.code}`);
  console.error(`   Message: ${error.message}`);

  if (error.code === 'PRIVATE_BATTLE') {
    console.error('');
    console.error('ℹ️  This is a private battle. Spectators not allowed.');
  }

  console.error('');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

console.log('⏳ Waiting for connection...');
console.log('');
