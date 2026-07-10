import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { UserRole } from '@contracts';
import { useAuthStatus, useSessionUser } from '@modules/auth/stores/auth-store';
import { pathForRole } from '@/router';

interface RoleGuardProps {
  /** Roles allowed into this subtree. */
  allow: UserRole[];
  children: ReactNode;
}

/**
 * Redirects users out of routes they cannot access:
 *   • Unauthenticated → /login (preserving the original `from` in state).
 *   • Authenticated wrong role → their canonical home (no audit-trail leak).
 *   • Deactivated account → /login (server will reject anyway; surface early).
 *
 * Children render only when access is confirmed. While the auth bootstrap
 * is still in flight, a glass loader covers the page so we don't flash
 * the wrong layout.
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const status = useAuthStatus();
  const user = useSessionUser();
  const location = useLocation();

  if (status === 'idle' || status === 'authenticating') {
    return <FullPageLoader />;
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!user.is_active) {
    return <Navigate to="/login" replace state={{ deactivated: true }} />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={pathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

function FullPageLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-navy"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="glass rounded-2xl px-6 py-4 text-sm text-text-muted">Loading…</div>
    </div>
  );
}
