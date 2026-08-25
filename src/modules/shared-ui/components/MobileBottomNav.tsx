import { Link, useLocation } from 'react-router-dom';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { NAV_CONFIG } from '@modules/shared-ui/nav-config';
import { cn } from '@lib/utils';

/**
 * 5-slot bottom navigation for narrow viewports. Pulls items from
 * NAV_CONFIG[role].mobile so the bar reflects the demo's per-role
 * essentials, not the entire sidebar.
 */
export function MobileBottomNav() {
  const user = useSessionUser();
  const location = useLocation();
  if (!user) return null;

  const items = NAV_CONFIG[user.role]?.mobile?.slice(0, 5) ?? [];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 h-[var(--mobile-nav-h)] glass border-t border-glass-border flex items-center justify-around px-2 pb-[max(0px,env(safe-area-inset-bottom))]"
      aria-label="Bottom navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const currentPath = location.pathname;
        const targetPath = item.to.split('?')[0];

        // Base dashboard path exact match check (e.g., /admin, /cs, /qc, etc.)
        const isBaseRoute = ['/admin', '/cs', '/qc', '/designer', '/sewout', '/digitator', '/team-lead'].includes(targetPath);

        let isActive = false;
        if (isBaseRoute) {
          isActive = currentPath === targetPath || currentPath === targetPath + '/';
        } else {
          isActive = currentPath === targetPath || currentPath.startsWith(targetPath + '/');
        }

        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[10.5px] font-semibold transition-all duration-200',
              isActive
                ? 'bg-[var(--color-crimson-glow)] text-[var(--color-crimson)] font-bold shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-white/5',
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'w-5 h-5 transition-transform duration-200',
                isActive ? 'text-[var(--color-crimson)] scale-110' : 'text-text-muted',
              )}
            />
            <span className={cn('leading-none', isActive ? 'text-[var(--color-crimson)] font-bold' : 'text-text-muted')}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
