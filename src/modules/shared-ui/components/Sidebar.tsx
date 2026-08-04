import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useSessionUser, useAuthStore } from '@modules/auth/stores/auth-store';
import { NAV_CONFIG, type NavItem } from '@modules/shared-ui/nav-config';
import { authService } from '@modules/auth/services';
import { cn, initials } from '@lib/utils';
import { UserRole } from '@contracts';
import { useAdminNavBadges, useCsNavBadges } from '@modules/admin-panel/hooks/use-admin-badges';

export const PROFILE_PATH: Record<UserRole, string> = {
  [UserRole.CLIENT]:    '/login',
  [UserRole.CS]:        '/cs/profile',
  [UserRole.TEAM_LEAD]: '/team-lead/profile',
  [UserRole.DESIGNER]:  '/designer/profile',
  [UserRole.DIGITATOR]: '/digitator/profile',
  [UserRole.SEWOUT]:    '/sewout/profile',
  [UserRole.QC]:        '/qc/profile',
  [UserRole.ADMIN]:     '/admin/profile',
};

interface SidebarProps {
  collapsedOnMobile: boolean;
  onNavigateMobile: () => void;
}

export function Sidebar({ collapsedOnMobile, onNavigateMobile }: SidebarProps) {
  const user = useSessionUser();
  const reset = useAuthStore((s) => s.reset);
  // Must be called unconditionally (Rules of Hooks). enabled=false when no user
  // or the wrong role, so no fetch fires in those cases.
  const adminBadges = useAdminNavBadges(user?.role === UserRole.ADMIN);
  const csBadges = useCsNavBadges(user?.role === UserRole.CS);

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) return null;

  const navConfig = NAV_CONFIG[user.role];

  async function handleSignOut() {
    setConfirmOpen(false);
    await authService.signOut();
    reset();
  }

  const asideClass = cn(
    'fixed top-0 left-0 z-40 h-full flex flex-col overflow-hidden transition-transform',
    'w-[var(--sidebar-w)] flex-shrink-0',
    'sidebar-shell border-r border-glass-border',
    collapsedOnMobile ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
  );

  return (
    <>
    <aside className={asideClass} aria-label="Primary navigation">
      {/* Brand */}
      <div className="px-4 pt-3 pb-3 border-b border-glass-border">
        <img
          src="/ch-logo.png"
          alt="CHANGE! Inc"
          className="h-9 w-auto"
          draggable={false}
        />
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-1 px-2" aria-label="Sections">
        {navConfig.sections.map((section) => (
          <div key={section.id} className="pt-2 pb-0.5">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-faint px-2 mb-1">
              {section.label}
            </div>
            <ul>
              {section.items.map((item) => {
                const dynamicBadge = user.role === UserRole.CS ? csBadges[item.id] : adminBadges[item.id];
                return (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    onClick={onNavigateMobile}
                    dynamicBadge={dynamicBadge}
                  />
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="mt-auto px-3 py-2.5 border-t border-glass-border bg-black/15">
        <div className="flex items-center gap-2.5">
          <NavLink
            to={PROFILE_PATH[user.role]}
            className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg hover:opacity-80 transition"
            aria-label="View my profile"
          >
            <div
              aria-hidden
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))',
                border: '1.5px solid rgba(255,255,255,0.2)',
                boxShadow: '0 2px 12px var(--color-crimson-glow)',
              }}
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold truncate" title={user.name}>
                {user.name.length > 15 ? `${user.name.slice(0, 15)}...` : user.name}
              </div>
              <div className="text-[10.5px] text-text-muted truncate">
                {navConfig.label}
                {user.sub_type ? ` · ${user.sub_type.toLowerCase()}` : ''}
              </div>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="ml-auto px-2 py-1.5 rounded-md border border-glass-border text-text-muted text-[11px] hover:border-crimson/50 hover:text-crimson transition flex-shrink-0"
            aria-label="Sign out"
          >
            <LogOut aria-hidden className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
    <LogoutConfirmDialog
      open={confirmOpen}
      onCancel={() => setConfirmOpen(false)}
      onConfirm={handleSignOut}
    />
    </>
  );
}

function SidebarItem({
  item,
  onClick,
  dynamicBadge,
}: {
  item: NavItem;
  onClick: () => void;
  dynamicBadge?: number;
}) {
  const Icon = item.icon;
  const location = useLocation();
  // Prefer dynamic count (from API); fall back to static value from nav-config.
  const badge = dynamicBadge ?? item.badge;
  const accent = item.badgeAccent ?? 'crimson';

  // Several CS nav items point at the same route with different `?project=`
  // / `?filter=` query strings (e.g. "Live", "Live Quote", "All Projects" all
  // resolve to /cs/projects). React Router's NavLink only compares pathname,
  // so it would highlight all of them at once — match the query string too
  // when the item's `to` specifies one, and require an *empty* query when it
  // doesn't (so "All Projects" isn't active while a filtered item is).
  const [itemPath, itemQuery = ''] = item.to.split('?');
  const itemParams = new URLSearchParams(itemQuery);
  const currentParams = new URLSearchParams(location.search);
  const isActive =
    location.pathname === itemPath &&
    itemParams.toString() === currentParams.toString();

  return (
    <li>
      {/* Plain Link, not NavLink — NavLink sets its own aria-current="page"
          off a pathname-only match internally, which the CSS keys off of
          too, so several query-string variants of the same route (e.g.
          /cs/projects?project=Live vs ?filter=In+Production) would all light
          up together even with a custom className override. Driving both
          the class AND aria-current from our own `isActive` avoids that. */}
      <Link
        to={item.to}
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        className={cn('nav-item', isActive && 'active')}
      >
        <Icon aria-hidden className="w-[15px] h-[15px] flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {badge !== undefined && badge > 0 ? (
          <span
            className={cn('nav-badge', accent !== 'crimson' && accent)}
            aria-label={`${badge} new`}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function LogoutConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 anim-fade-in"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm sign out"
        className="glass-heavy rounded-2xl w-full max-w-[360px] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-bold mb-2">
          Sign out?
        </h2>
        <p className="text-[13px] text-text-muted leading-relaxed mb-6">
          You will need to log in again to access your account.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
          >
            Stay signed in
          </button>
          <button
            type="button"
            className="btn btn-crimson"
            onClick={onConfirm}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
