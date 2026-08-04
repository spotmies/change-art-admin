import { create } from 'zustand';
import type { SessionUser } from '@contracts';

/**
 * Global auth state — populated by AuthProvider on mount and on every
 * sign-in/sign-out. The session source of truth is the HTTP-only cookie
 * set by Better Auth; this store only mirrors what the server returns
 * from `GET /api/v1/auth/session` (the sanitized wrapper — never the raw
 * `/api/auth/get-session`).
 *
 * The store NEVER persists to localStorage or sessionStorage. A page
 * reload re-fetches the session from the server so a stale store can't
 * grant access that the cookie no longer authorises.
 */

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;

  setUser: (user: SessionUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,

  setUser: (user) =>
    set({
      user,
      status: user ? 'authenticated' : 'unauthenticated',
    }),
  setStatus: (status) => set({ status }),
  reset: () => set({ status: 'unauthenticated', user: null }),
}));

/** Selector hooks — avoids unnecessary re-renders for consumers that only need one field. */
export const useSessionUser = (): SessionUser | null => useAuthStore((s) => s.user);
export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status);
export const useIsAuthenticated = (): boolean => useAuthStore((s) => s.status === 'authenticated');
