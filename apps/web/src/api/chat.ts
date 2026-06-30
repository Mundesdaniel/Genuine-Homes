import type {
  ConversationSummary,
  MessageResponse,
  Paginated,
  SendMessageInput,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const chatApi = {
  conversations: () =>
    api.get<ConversationSummary[]>('/chat/conversations').then((r) => r.data),
  thread: (withUserId: string, page = 1, pageSize = 100) =>
    api
      .get<Paginated<MessageResponse>>('/chat/messages', {
        params: { withUserId, page, pageSize },
      })
      .then((r) => r.data),
  send: (input: SendMessageInput) =>
    api.post<MessageResponse>('/chat/messages', input).then((r) => r.data),
};
