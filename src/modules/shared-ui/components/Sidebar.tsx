import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useSessionUser, useAuthStore } from '@modules/auth/stores/auth-store';
import { NAV_CONFIG, type NavItem } from '@modules/shared-ui/nav-config';
import { authService } from '@modules/auth/services';
import { cn, initials } from '@lib/utils';
import { UserRole } from '@contracts';
import { useAdminNavBadges } from '@modules/admin-panel/hooks/use-admin-badges';

// Per-section "seen" baselines, persisted so a cleared badge stays cleared
// across reloads and only re-lights when the live count grows past it.
const NAV_SEEN_KEY = 'admin-nav-seen';

function readNavSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(NAV_SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

const PROFILE_PATH: Record<UserRole, string> = {
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
  const location = useLocation();
  // Must be called unconditionally (Rules of Hooks). enabled=false when no user
  // or non-admin role, so no fetch fires in those cases.
  const adminBadges = useAdminNavBadges(user?.role === UserRole.ADMIN);

  const [seen, setSeen] = useState<Record<string, number>>(readNavSeen);

  const markSeen = useCallback((id: string, count: number) => {
    setSeen((prev) => {
      if (prev[id] === count) return prev;
      const next = { ...prev, [id]: count };
      try { localStorage.setItem(NAV_SEEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Reconcile baselines: clear a badge while you're viewing its section, and
  // lower the baseline when items get processed so genuinely-new arrivals
  // re-light it.
  useEffect(() => {
    if (user?.role !== UserRole.ADMIN) return;
    const items = NAV_CONFIG[UserRole.ADMIN].sections.flatMap((s) => s.items);
    for (const [id, live] of Object.entries(adminBadges)) {
      const item = items.find((it) => it.id === id);
      if (!item) continue;
      const onPage = location.pathname.startsWith(item.to);
      const base = seen[id] ?? 0;
      if (onPage) {
        if (base !== live) markSeen(id, live);
      } else if (live < base) {
        markSeen(id, live);
      }
    }
  }, [adminBadges, location.pathname, seen, markSeen, user]);

  if (!user) return null;

  const navConfig = NAV_CONFIG[user.role];

  async function handleSignOut() {
    await authService.signOut();
    reset();
  }

  const asideClass = cn(
    'fixed top-0 left-0 z-40 h-full flex flex-col overflow-hidden transition-transform',
    'w-[var(--sidebar-w)] flex-shrink-0',
    'glass-heavy border-r border-glass-border',
    collapsedOnMobile ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
  );

  return (
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

      {/* Role pill */}
      <div className="role-pill">
        <div className="role-pill-dot" />
        <div className="role-pill-text">{navConfig.label}</div>
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
                const live = adminBadges[item.id];
                const dynamicBadge =
                  live === undefined ? undefined : Math.max(0, live - (seen[item.id] ?? 0));
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
              <div className="text-[12px] font-semibold truncate">{user.name}</div>
              <div className="text-[10.5px] text-text-muted truncate">
                {navConfig.label}
                {user.sub_type ? ` · ${user.sub_type.toLowerCase()}` : ''}
              </div>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto px-2 py-1.5 rounded-md border border-glass-border text-text-muted text-[11px] hover:border-crimson/50 hover:text-crimson transition flex-shrink-0"
            aria-label="Sign out"
          >
            <LogOut aria-hidden className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
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
  // Prefer dynamic count (from API); fall back to static value from nav-config.
  const badge = dynamicBadge ?? item.badge;
  const accent = item.badgeAccent ?? 'crimson';
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to.split('/').length <= 2}
        onClick={onClick}
        className={({ isActive }) => cn('nav-item', isActive && 'active')}
      >
        <Icon aria-hidden className="w-[15px] h-[15px] flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {badge !== undefined && badge > 0 ? (
          <span
            className={cn(
              'nav-badge',
              accent === 'amber' && 'amber',
              accent === 'navy' && 'navy',
            )}
            aria-label={`${badge} new`}
          >
            {badge}
          </span>
        ) : null}
      </NavLink>
    </li>
  );
}
