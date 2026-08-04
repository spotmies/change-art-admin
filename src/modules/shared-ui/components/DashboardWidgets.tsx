import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';
import { Panel } from './Panel';

export interface OverviewItem {
  id: string;
  label: string;
  value: number;
  /** 'danger' renders the value in red, e.g. for overdue counts. */
  tone?: 'default' | 'danger';
  href?: string;
  /** Leading icon rendered in a small pastel circle, matching the reference dashboard. */
  icon?: ReactNode;
  /** Accent hex colour driving the icon + label colour, e.g. '#3b82f6'. */
  accent?: string;
}

interface TodaysOverviewPanelProps {
  items: OverviewItem[];
  viewAllHref?: string;
}

/** "Today's Overview" panel — a compact icon/label/count list, per the reference dashboard. */
export function TodaysOverviewPanel({ items, viewAllHref }: TodaysOverviewPanelProps) {
  return (
    <Panel
      className="p-3"
      title={<span className="font-extrabold text-[12px] text-text-main text-left block">Today's Overview</span>}
      action={viewAllHref ? <Link to={viewAllHref} className="text-[#4f46e5] dark:text-[#818cf8] font-bold text-[10px] hover:underline">View All</Link> : undefined}
    >
      <ul className="flex flex-col gap-1 mt-1">
        {items.map((item) => {
          const dangerAccent = '#ef4444';
          const accent = item.tone === 'danger' ? dangerAccent : item.accent;
          const isDanger = item.tone === 'danger';
          const row = (
            <div className="flex items-center justify-between text-[10.5px] py-0 text-left">
              <span className="flex items-center gap-1.5 min-w-0 text-left">
                {item.icon ? (
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: accent ? `${accent}18` : 'rgba(148, 163, 184, 0.15)',
                      color: accent ?? 'var(--text-muted)',
                    }}
                  >
                    {item.icon}
                  </span>
                ) : null}
                <span
                  className={cn('truncate font-bold text-left', isDanger ? 'text-[#ef4444] font-extrabold' : 'text-[#0f172a] dark:text-white')}
                >
                  {item.label}
                </span>
              </span>
              <span
                className={cn(
                  'font-extrabold text-[11px] flex-shrink-0 ml-2 text-right',
                  isDanger ? 'text-[#ef4444]' : 'text-[#0f172a] dark:text-white',
                )}
              >
                {item.value}
              </span>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link to={item.href} className="block hover:opacity-75 transition">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export interface ActivityItem {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  time: string;
  /** Accent hex colour for the icon circle, e.g. '#3b82f6'. Defaults to the crimson brand colour. */
  accent?: string;
}

interface RecentActivityPanelProps {
  items: ActivityItem[];
  viewAllHref?: string;
  onViewAll?: () => void;
}

/** "Recent Activity" panel — a small icon + title/subtitle + relative-time timeline with "View All" link button. */
export function RecentActivityPanel({ items, viewAllHref = '/admin/jobs', onViewAll }: RecentActivityPanelProps) {
  return (
    <Panel
      className="p-3"
      title={<span className="font-extrabold text-[12px] text-text-main text-left block">Recent Activity</span>}
      action={
        <Link
          to={viewAllHref}
          onClick={onViewAll}
          className="text-[#4f46e5] dark:text-[#818cf8] font-bold text-[10px] hover:underline"
        >
          View All
        </Link>
      }
    >
      <ul className="flex flex-col gap-2 mt-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-left">
            <span
              aria-hidden
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
              style={
                item.accent
                  ? { background: `${item.accent}18`, color: item.accent }
                  : { background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-crimson)' }
              }
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className="text-[10.5px] font-bold text-[#0f172a] dark:text-white truncate text-left">{item.title}</div>
              <div className="text-[9.5px] font-medium text-[#94a3b8] dark:text-[#94a3b8] truncate text-left">{item.subtitle}</div>
            </div>
            <span className="flex-shrink-0 text-[9.5px] text-[#94a3b8] dark:text-[#94a3b8] whitespace-nowrap ml-2 text-right">{item.time}</span>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-[10.5px] text-[#94a3b8] py-1 text-left">No recent activity.</li>
        ) : null}
      </ul>
    </Panel>
  );
}

interface EmailInboxCtaProps {
  href: string;
  unreadCount: number;
}

/** "Go to Email Inbox" CTA panel, matching the bottom-right block in the reference. */
export function EmailInboxCta({ href, unreadCount }: EmailInboxCtaProps) {
  return (
    <Link
      to={href}
      className="rounded-xl px-4 py-3.5 flex items-center gap-3 text-white transition hover:opacity-90"
      style={{ background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))' }}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold">Go to Email Inbox</span>
        <span className="block text-[11.5px] opacity-85">
          You have {unreadCount} unread email{unreadCount === 1 ? '' : 's'}
        </span>
      </span>
      <ChevronRight aria-hidden className="w-4 h-4 flex-shrink-0" />
    </Link>
  );
}
