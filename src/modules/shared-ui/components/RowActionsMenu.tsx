import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '@lib/utils';

export interface RowAction {
  /** Stable key for the list. */
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Renders the item in the crimson danger colour (plain text style). */
  danger?: boolean;
  /**
   * Renders the item as a filled crimson CTA button inside the dropdown.
   * Use for the primary "send" action so it pops visually against plain items.
   */
  accent?: 'crimson';
  disabled?: boolean;
  /** Native tooltip — useful to explain why a disabled item can't be used. */
  title?: string;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  ariaLabel?: string;
}

/**
 * Compact kebab (⋮) menu for table-row actions. The menu is portalled to
 * `document.body` with fixed positioning so it is never clipped by an ancestor
 * `overflow-x-auto` table wrapper (the row's actions cell lives inside one).
 * Closes on outside click, Esc, or scroll — mirroring NotificationBell's popover.
 */
export function RowActionsMenu({ actions, ariaLabel = 'Row actions' }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Any scroll would leave the fixed menu detached from its trigger — close it.
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-outline !p-2"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical aria-hidden className="w-4 h-4" />
      </button>

      {open && pos
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[59]"
                role="presentation"
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                className="fixed min-w-[184px] glass-heavy rounded-xl z-[60] overflow-hidden py-1 anim-fade-in"
                style={{ top: pos.top, right: pos.right }}
              >
                {actions.map((a) =>
                  a.accent === 'crimson' ? (
                    /* Accent item — rendered as a full-width crimson button inside the menu */
                    <div key={a.key} className="px-2.5 py-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={a.disabled}
                        title={a.title}
                        className={cn(
                          'btn btn-crimson w-full !py-1.5 !px-3 !text-[12.5px] flex items-center justify-center gap-1.5',
                        )}
                        onClick={() => {
                          setOpen(false);
                          a.onSelect();
                        }}
                      >
                        {a.icon}
                        {a.label}
                      </button>
                    </div>
                  ) : (
                    <button
                      key={a.key}
                      type="button"
                      role="menuitem"
                      disabled={a.disabled}
                      title={a.title}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition-colors',
                        'hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed',
                        a.danger ? 'text-[var(--crimson)]' : 'text-text-main',
                      )}
                      onClick={() => {
                        setOpen(false);
                        a.onSelect();
                      }}
                    >
                      {a.icon}
                      {a.label}
                    </button>
                  ),
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
