import { Server } from 'socket.io';

/**
 * Global Socket.io registry
 *
 * Provides access to Socket.io server instance from REST routes
 * Must be initialized in index.ts after Socket.io server creation
 */

let ioInstance: Server | null = null;

/**
 * Register the Socket.io server instance
 *
 * @param io - Socket.io server instance
 */
export function registerSocketInstance(io: Server): void {
  ioInstance = io;
}

/**
 * Get the Socket.io server instance
 *
 * @returns Socket.io server instance
 * @throws Error if not initialized
 */
export function getSocketInstance(): Server {
  if (!ioInstance) {
    throw new Error('Socket.io instance not initialized. Call registerSocketInstance() first.');
  }
  return ioInstance;
}
