import { io, type Socket } from 'socket.io-client';

/**
 * Connect to the chat WebSocket namespace. The API base URL points at `/api`;
 * the socket server lives at the origin root, so strip the `/api` suffix.
 * The access token is sent in the handshake auth payload (see ChatGateway).
 */
const apiBase = import.meta.env.VITE_API_URL ?? '/api';
const origin = apiBase.replace(/\/api\/?$/, '');

export function createChatSocket(token: string): Socket {
  return io(`${origin}/chat`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
}
