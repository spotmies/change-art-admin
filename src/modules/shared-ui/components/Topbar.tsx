import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, Menu, Search } from 'lucide-react';
import { useAuthStore, useIsAuthenticated, useSessionUser } from '@modules/auth/stores/auth-store';
import { authService } from '@modules/auth/services';
import { usePendingEmailCount } from '@modules/admin-panel/hooks/use-admin-badges';
import { NAV_CONFIG } from '@modules/shared-ui/nav-config';
import { UserRole } from '@contracts';
import { cn, initials } from '@lib/utils';
import { NotificationBell } from './NotificationBell';
import { PROFILE_PATH, LogoutConfirmDialog } from './Sidebar';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onOpenMobileNav: () => void;
  hideSearch?: boolean;
}

const EMAIL_INBOX_PATH: Partial<Record<UserRole, string>> = {
  [UserRole.CS]: '/cs/email-inbox',
  [UserRole.ADMIN]: '/admin/email-inbox',
};

/** Top app bar — page title/greeting + search + mail + notifications + user menu. */
export function Topbar({ title: _title, subtitle: _subtitle, onOpenMobileNav, hideSearch }: TopbarProps) {
  const isAuthenticated = useIsAuthenticated();
  const user = useSessionUser();
  const emailInboxPath = user ? EMAIL_INBOX_PATH[user.role] : undefined;
  const pendingEmailCount = usePendingEmailCount(isAuthenticated && !!emailInboxPath);
  const unread = pendingEmailCount ?? 0;

  return (
    <header
      className="sticky top-0 z-30 h-[var(--topbar-h)] px-4 md:px-6 flex items-center gap-3 border-b border-glass-border glass"
      aria-label="Top bar"
    >
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="md:hidden btn btn-outline !p-2"
        aria-label="Open navigation"
      >
        <Menu aria-hidden className="w-4 h-4" />
      </button>

      <div className="min-w-0 flex-1 flex items-center gap-3">
        <img
          src="/ch-logo.png"
          alt="CHANGE! Inc"
          className="h-8 w-auto shrink-0"
          draggable={false}
        />
      </div>

      {/* Search bar */}
      {!hideSearch ? (
        <label className="hidden lg:flex items-center w-full max-w-[420px] relative" htmlFor="topbar-search">
          <input
            id="topbar-search"
            type="search"
            placeholder="Search by Job ID, Client, Project, or Keyword..."
            className="w-full bg-[#f1f5f9] border border-slate-200/50 rounded-lg pl-4 pr-11 py-2 text-[12.5px] text-text-main placeholder-text-faint focus:outline-none transition-all"
          />
          <span
            aria-hidden
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#002868] text-white absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            <Search aria-hidden className="w-3.5 h-3.5" />
          </span>
        </label>
      ) : null}

      <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block" />

      {emailInboxPath ? (
        <Link
          to={emailInboxPath}
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-text-main transition"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--glass-border)',
          }}
          aria-label={unread > 0 ? `Email inbox, ${unread} unread` : 'Email inbox'}
        >
          <Mail aria-hidden strokeWidth={3} className="w-[18px] h-[18px]" />
          {unread > 0 ? (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white leading-none"
              style={{ background: 'var(--color-crimson, #c41e3a)' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      ) : null}

      <NotificationBell />

      <UserMenu />
    </header>
  );
}

function UserMenu() {
  const user = useSessionUser();
  const reset = useAuthStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!user) return null;

  const navConfig = NAV_CONFIG[user.role];

  async function handleSignOut() {
    setConfirmOpen(false);
    setOpen(false);
    await authService.signOut();
    reset();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full hover:bg-black/5 transition"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div
          aria-hidden
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12.5px] font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))',
            border: '1.5px solid rgba(255,255,255,0.2)',
            boxShadow: '0 2px 12px var(--color-crimson-glow)',
          }}
        >
          {initials(user.name)}
        </div>
        <div className="min-w-0 hidden sm:block text-left">
          <div className="text-[12px] font-semibold truncate leading-tight" title={user.name}>
            {user.name.length > 15 ? `${user.name.slice(0, 15)}...` : user.name}
          </div>
          <div className="text-[10.5px] text-text-muted truncate leading-tight">{navConfig.label}</div>
        </div>
        <ChevronDown aria-hidden className={cn('w-3.5 h-3.5 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[180px] glass-heavy rounded-xl z-40 overflow-hidden py-1"
        >
          <Link
            to={PROFILE_PATH[user.role]}
            role="menuitem"
            className="block px-3 py-2 text-[12.5px] font-medium hover:bg-black/5 transition"
            onClick={() => setOpen(false)}
          >
            View Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[12.5px] font-medium text-[var(--color-crimson)] hover:bg-black/5 transition"
            onClick={() => setConfirmOpen(true)}
          >
            Sign Out
          </button>
        </div>
      ) : null}

      <LogoutConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSignOut}
      />
    </div>
  );
}
