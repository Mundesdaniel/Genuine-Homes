import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

/** Validate the stored session against the API and keep the user fresh. */
export function useCurrentUser() {
  const token = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
}

/** Revoke the session server-side (best-effort) and clear local state. */
export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    const { clear } = useAuthStore.getState();
    try {
      // The refresh token rides in the httpOnly cookie; the API revokes the
      // session and clears the cookie.
      await authApi.logout();
    } catch (error) {
      // Logout is best-effort; ignore network/expiry errors.
      void apiErrorMessage(error);
    } finally {
      clear();
      queryClient.clear();
    }
  };
}
