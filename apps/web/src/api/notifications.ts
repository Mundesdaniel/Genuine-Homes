import type {
  NotificationResponse,
  Paginated,
  UnreadCountResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const notificationsApi = {
  list: (page = 1, pageSize = 20) =>
    api
      .get<Paginated<NotificationResponse>>('/notifications', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  unreadCount: () =>
    api.get<UnreadCountResponse>('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) =>
    api.post<UnreadCountResponse>(`/notifications/${id}/read`, {}).then((r) => r.data),
  markAllRead: () =>
    api.post<UnreadCountResponse>('/notifications/read-all', {}).then((r) => r.data),
};
