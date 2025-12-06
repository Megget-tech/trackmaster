import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '@shared/types';

const SOCKET_URL = window.location.origin;

/**
 * SocketService - Type-safe Socket.io wrapper for TrackMaster
 *
 * Provides convenient methods to emit and listen to game events
 */
class SocketService {
  private socket: Socket<SocketEvents> | null = null;

  /**
   * Connect to server
   */
  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      this.socket.on('error', (message: string) => {
        console.error('Socket error:', message);
      });
    }
    return this.socket;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Emit an event to the server
   */
  emit<K extends keyof SocketEvents>(event: K, ...args: Parameters<SocketEvents[K]>) {
    if (!this.socket) {
      this.connect();
    }
    // @ts-ignore - Socket.io typing complexity
    this.socket?.emit(event, ...args);
  }

  /**
   * Listen to an event from the server
   */
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (!this.socket) {
      this.connect();
    }
    // @ts-ignore - Socket.io typing complexity
    this.socket?.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event: keyof SocketEvents) {
    this.socket?.off(event as string);
  }

  /**
   * Get the raw socket instance
   */
  getSocket() {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Auto-connect on import
socketService.connect();
