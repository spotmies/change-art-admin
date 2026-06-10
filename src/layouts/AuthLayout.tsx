import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStatus, useSessionUser, useAuthStore } from '@modules/auth/stores/auth-store';
import { pathForRole } from '@/router';
import { config } from '@lib/config';
import { UserRole } from '@contracts';
import { authService } from '@modules/auth/services';

/**
 * Unauthenticated-routes shell. Houses the login / register / forgot-password
 * pages inside a centred glass card that mirrors the change_artwork demo's
 * #login-screen treatment.
 *
 * If the user is already authenticated, redirect to their canonical home —
 * the auth pages should never be reachable mid-session.
 */
export function AuthLayout() {
  const status = useAuthStatus();
  const user = useSessionUser();
  const reset = useAuthStore((s) => s.reset);
  const location = useLocation();

  // If a CLIENT session somehow exists, sign it out immediately to prevent
  // an infinite redirect loop (CLIENT has no route in this admin app).
  const isStuckClient = status === 'authenticated' && user?.role === UserRole.CLIENT;
  useEffect(() => {
    if (isStuckClient) {
      authService.signOut().then(() => reset());
    }
  }, [isStuckClient, reset]);

  if (status === 'authenticating' || isStuckClient) {
    return null;
  }

  if (status === 'authenticated' && user) {
    const fallback = pathForRole(user.role);
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? fallback} replace />;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 relative">
      <div className="w-full max-w-[460px] glass-heavy rounded-2xl px-9 py-11 anim-login">
        <header className="mb-7">
          <img
            src="/ch-logo.png"
            alt="Change! Digitizing & Design Services"
            className="h-11 w-auto mb-2"
            draggable={false}
          />
          <p className="text-[11px] text-text-muted">{config.appName} · Production lifecycle for creative agencies</p>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
