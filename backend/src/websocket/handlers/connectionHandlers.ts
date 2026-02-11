import { Socket, Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Register connection lifecycle handlers
 *
 * Handles:
 * - Initial connection confirmation
 * - Disconnection cleanup (leave battle rooms, notify others)
 * - Ping/pong for connection health monitoring
 *
 * @param io - Socket.io server instance
 * @param socket - Individual socket connection
 * @param logger - Fastify logger for structured logging
 */
export function registerConnectionHandlers(
  _io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  logger: FastifyBaseLogger
) {
  // Send connection confirmation
  socket.emit('connected', {
    socketId: socket.id,
    role: socket.data.role,
    agentId: socket.data.agent?.id
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    // Get all rooms this socket was in
    const rooms = Array.from(socket.rooms);

    // Notify battle rooms about participant leaving
    rooms.forEach(room => {
      if (room.startsWith('battle:') && room !== socket.id) {
        socket.to(room).emit('battle:participant_left', {
          agentId: socket.data.agent?.id,
          role: socket.data.role
        });
      }
    });

    // Log disconnection with structured logging
    logger.info({
      socketId: socket.id,
      reason,
      role: socket.data.role,
      agentId: socket.data.agent?.id
    }, 'Socket disconnected');
  });

  // Ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
}
