import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStatus, useSessionUser, useAuthStore } from '@modules/auth/stores/auth-store';
import { pathForRole } from '@/router';
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

  // If a CLIENT or deactivated session exists, sign out immediately to prevent
  // an infinite redirect loop (CLIENT has no route; deactivated → RoleGuard
  // sends them back here → AuthLayout sends them to dashboard → loop).
  const isStuckClient = status === 'authenticated' && user?.role === UserRole.CLIENT;
  const isDeactivated = status === 'authenticated' && !!user && !user.is_active;
  useEffect(() => {
    if (isStuckClient || isDeactivated) {
      authService.signOut().then(() => reset());
    }
  }, [isStuckClient, isDeactivated, reset]);

  if (status === 'authenticating' || isStuckClient || isDeactivated) {
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
        <header className="mb-7 flex justify-center">
          <img
            src="/ch-logo.png"
            alt="Change! Digitizing & Design Services"
            className="h-11 w-auto"
            draggable={false}
          />
        </header>

        <Outlet />
      </div>
    </div>
  );
}
