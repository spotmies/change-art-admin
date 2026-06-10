import { Menu, Search, SendHorizontal } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onOpenMobileNav: () => void;
}

/**
 * Top app bar — page title + AI search placeholder + bell + theme + avatar.
 * Upgraded in v1 to a gorgeous, premium rounded glass interface as requested, using NAV_CONFIG dynamic metadata.
 */
export function Topbar({ title, subtitle, onOpenMobileNav }: TopbarProps) {
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

      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] font-semibold text-text-main leading-tight truncate tracking-wide">{title}</h1>
        {subtitle ? (
          <p className="text-[11.5px] text-text-muted mt-0.5 font-medium truncate">{subtitle}</p>
        ) : null}
      </div>

      {/* AI search placeholder — premium pills-shaped component matching specifications */}
      <label className="hidden lg:flex items-center w-full max-w-[320px] relative" htmlFor="ai-search">
        <Search aria-hidden className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          id="ai-search"
          type="text"
          placeholder="Ask AI anything..."
          disabled
          aria-disabled="true"
          title="AI search is coming in a future release"
          className="w-full bg-[#f1f5f9] border border-slate-200/50 rounded-full pl-10 pr-11 py-2 text-[12.5px] text-text-main placeholder-text-faint focus:outline-none disabled:cursor-not-allowed transition-all"
        />
        <button
          type="button"
          disabled
          aria-label="Send query"
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#002868] text-white absolute right-1.5 top-1/2 -translate-y-1/2 opacity-90 cursor-not-allowed hover:opacity-100 transition-opacity"
        >
          <SendHorizontal aria-hidden className="w-3.5 h-3.5" />
        </button>
      </label>

      <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block" />

      <NotificationBell />

    </header>
  );
}
