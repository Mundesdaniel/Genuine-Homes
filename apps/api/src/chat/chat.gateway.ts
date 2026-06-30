import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';

/**
 * Realtime delivery for chat. Clients connect to the `/chat` namespace with
 * their access token (handshake `auth.token`); on success they join a private
 * room keyed by their user id. The server only pushes — clients send messages
 * over REST — so there are no inbound message handlers to validate here.
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly tokens: TokenService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('missing token');
      const payload = await this.tokens.verifyAccess(token);
      client.data.userId = payload.sub;
      await client.join(ChatGateway.room(payload.sub));
    } catch {
      // Unauthenticated sockets are dropped immediately.
      client.disconnect(true);
    }
  }

  /** Push a payload to every live socket of a given user. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(ChatGateway.room(userId)).emit(event, payload);
  }

  private static room(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof auth === 'string' && auth.length > 0) return auth;
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
