import { useMemo, useState } from 'react';
import { Check, CheckCheck, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GreetingHero, Pagination, Panel, StatGrid } from '@modules/shared-ui';
import { NotificationType, type INotification } from '@contracts';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../../modules/notifications/hooks/use-notifications';

const PER_PAGE = 20;

type ReadFilter = 'all' | 'unread';

const READ_FILTERS: { id: ReadFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

const TYPE_LABEL: Record<NotificationType, string> = {
  [NotificationType.JOB_STATUS_CHANGE]: 'Job Status',
  [NotificationType.ASSIGNMENT]: 'Assignment',
  [NotificationType.REVIEW_FEEDBACK]: 'Review',
  [NotificationType.QC_DECISION]: 'QC',
  [NotificationType.MODIFICATION_REQUEST]: 'Modification',
  [NotificationType.QUOTE_UPDATE]: 'Quote',
  [NotificationType.DELIVERY]: 'Delivery',
  [NotificationType.SYSTEM]: 'System',
  [NotificationType.CLIENT_DATA_ACCESSED]: 'Data Access',
  [NotificationType.QUERY]: 'Query',
};

const TYPE_BADGE: Record<NotificationType, string> = {
  [NotificationType.JOB_STATUS_CHANGE]: 'blue',
  [NotificationType.ASSIGNMENT]: 'gold',
  [NotificationType.REVIEW_FEEDBACK]: 'navy',
  [NotificationType.QC_DECISION]: 'green',
  [NotificationType.MODIFICATION_REQUEST]: 'amber',
  [NotificationType.QUOTE_UPDATE]: 'navy',
  [NotificationType.DELIVERY]: 'green',
  [NotificationType.SYSTEM]: 'gray',
  [NotificationType.CLIENT_DATA_ACCESSED]: 'gray',
  [NotificationType.QUERY]: 'purple',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminNotificationsPage() {
  const navigate = useNavigate();
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      page: 1,
      per_page: 100,
      ...(readFilter === 'unread' ? { unread_only: true } : {}),
    }),
    [readFilter],
  );

  const { data, isLoading, isError } = useNotifications(filters);
  const { data: countData } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.meta.total ?? items.length;
  const unread = countData?.count ?? 0;

  // Client-side type + search filtering on top of the server's read filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.body ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page">
      <GreetingHero
        title="Notifications"
        subtitle="Every in-app notification delivered to your account — jobs, quotes, deliveries, and system updates."
      />

      <StatGrid
        stats={[
          { accent: 'blue', label: 'Total', value: isLoading ? '…' : total },
          { accent: 'crimson', label: 'Unread', value: unread },
          {
            accent: 'green',
            label: 'Read',
            value: isLoading ? '…' : Math.max(0, total - unread),
          },
          {
            accent: 'gold',
            label: 'Latest',
            value: items[0] ? formatDateTime(items[0].created_at) : '—',
          },
        ]}
      />

      <Panel
        title={`All Notifications${total ? ` (${total})` : ''}`}
        action={
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => markAllRead.mutate()}
            disabled={unread === 0 || markAllRead.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5" aria-hidden />
            {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        }
      >
        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-glass-border">
            {READ_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn ${readFilter === f.id ? 'btn-crimson' : 'btn-outline'}`}
                onClick={() => {
                  setReadFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
                {f.id === 'unread' && unread > 0 ? (
                  <span
                    className="ml-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5"
                    style={{
                      background: 'var(--color-crimson)',
                      color: 'white',
                      minWidth: 16,
                      height: 16,
                    }}
                  >
                    {unread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <select
            className="fi"
            style={{ width: 'auto', minWidth: 140 }}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as NotificationType | 'ALL');
              setPage(1);
            }}
            aria-label="Filter by type"
          >
            <option value="ALL">All types</option>
            {Object.values(NotificationType).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px] max-w-md ml-auto">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint"
              aria-hidden
            />
            <input
              type="text"
              className="fi"
              style={{ paddingLeft: 28, paddingRight: search ? 32 : undefined }}
              placeholder="Search title or body…"
              value={search}
              maxLength={500}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search notifications"
            />
            {search && (
              <button
                type="button"
                className="fjb-search-x"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            Loading notifications…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-12 text-[var(--color-crimson)] text-sm">
            Failed to load notifications. Please refresh and try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            {search.trim() || typeFilter !== 'ALL' || readFilter === 'unread'
              ? 'No notifications match your filters.'
              : 'You have no notifications yet.'}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {pageRows.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={() => markRead.mutate(n.id)}
                  busy={markRead.isPending}
                  onNavigate={(path) => navigate(path)}
                />
              ))}
            </ul>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

/** Resolve where clicking this notification should navigate, if anywhere. */
function getNotificationPath(n: INotification): string | null {
  const data = n.data as Record<string, unknown> | null;
  const jobId = data?.jobId as string | undefined;
  const kind = data?.kind as string | undefined;
  if (kind === 'profile_change_submitted') return '/admin/clients?tab=requests';
  if (jobId) return `/admin/jobs?open=${jobId}`;
  return null;
}

interface RowProps {
  notification: INotification;
  onMarkRead: () => void;
  busy: boolean;
  onNavigate: (path: string) => void;
}

function NotificationRow({ notification: n, onMarkRead, busy, onNavigate }: RowProps) {
  const path = getNotificationPath(n);

  function handleClick() {
    if (!n.is_read) onMarkRead();
    if (path) onNavigate(path);
  }

  return (
    <li
      className="flex items-start gap-3 px-3 py-2.5 rounded-md border border-glass-border transition-colors"
      style={{
        background: n.is_read ? 'transparent' : 'rgba(220,38,38,0.04)',
        cursor: path ? 'pointer' : 'default',
      }}
      onClick={path ? handleClick : undefined}
      role={path ? 'button' : undefined}
      tabIndex={path ? 0 : undefined}
      onKeyDown={path ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
    >
      <span
        aria-hidden
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: n.is_read ? 'transparent' : 'var(--color-crimson)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${TYPE_BADGE[n.type]}`}>{TYPE_LABEL[n.type]}</span>
          <span className="font-semibold text-[13px]">{n.title}</span>
          <span className="text-[11px] text-text-faint ml-auto">
            {formatDateTime(n.created_at)}
          </span>
        </div>
        {n.body ? (
          <div className="text-[12px] text-text-muted mt-1 whitespace-pre-wrap">{n.body}</div>
        ) : null}
        {path ? (
          <div className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)', fontWeight: 600 }}>
            {path.startsWith('/admin/clients') ? 'Click to review request →' : 'Click to open job →'}
          </div>
        ) : null}
      </div>
      {!n.is_read ? (
        <button
          type="button"
          className="btn btn-outline shrink-0"
          aria-label="Mark as read"
          onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
          disabled={busy}
        >
          <Check className="w-3.5 h-3.5" aria-hidden />
          Mark read
        </button>
      ) : null}
    </li>
  );
}
