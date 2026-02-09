import { useEffect, useRef } from 'react';
import { battleSocket, type SocketEventHandlers } from '@/lib/socket';

/**
 * Hook to manage WebSocket connection for a battle
 */
export function useBattleSocket(battleId: string, token?: string) {
  const socketRef = useRef(battleSocket);

  useEffect(() => {
    socketRef.current.connect(battleId, token);

    return () => {
      socketRef.current.disconnect();
    };
  }, [battleId, token]);

  return socketRef.current;
}

/**
 * Hook to register socket event listeners
 */
export function useSocketEvent<K extends keyof SocketEventHandlers>(
  event: K,
  handler: SocketEventHandlers[K]
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler = ((...args: any[]) => {
      (handlerRef.current as any)(...args);
    }) as SocketEventHandlers[K];

    battleSocket.on(event, wrappedHandler);

    return () => {
      battleSocket.off(event, wrappedHandler);
    };
  }, [event]);
}
