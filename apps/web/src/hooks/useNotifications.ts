import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { useAuthStore } from '@/store/authStore';

const UNREAD_KEY = ['notifications', 'unread-count'];
const LIST_KEY = ['notifications', 'list'];

/** Poll the unread count for the header badge (only while signed in). */
export function useUnreadCount() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: notificationsApi.unreadCount,
    enabled: Boolean(token),
    // Light-touch polling keeps the badge fresh without a socket.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Recent notifications for the dropdown. Fetched when the panel opens. */
export function useNotifications(enabled: boolean) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => notificationsApi.list(1, 20),
    enabled: enabled && Boolean(token),
    staleTime: 15_000,
  });
}

/** Refresh both the badge and the list after any read action. */
function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}
