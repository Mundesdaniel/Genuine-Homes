import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, AuthUser } from '@genuine-homes/shared';

/**
 * Session state. Only the short-lived access token and the user profile are
 * persisted — the refresh token lives in the httpOnly `gh_refresh` cookie the
 * API sets, where page scripts (and therefore XSS) can't read it.
 */
interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (res: AuthResponse) => void;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (res) => set({ accessToken: res.accessToken, user: res.user }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'gh-auth',
      version: 1,
      // v0 persisted the refresh token in localStorage — scrub it on upgrade.
      migrate: (persisted) => {
        const { accessToken = null, user = null } =
          (persisted as Partial<AuthState> | undefined) ?? {};
        return { accessToken, user };
      },
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
);
