import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@lib/utils';
import {
  JobTable,
  Pagination,
  Pills,
  CsStatGrid,
  TodaysOverviewPanel,
  RecentActivityPanel,
  EmailInboxCta,
  JobFilterBar,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  applyJobFilters,
  type CsStatCardProps,
  type PillItem,
  type OverviewItem,
  type ActivityItem,
  type JobFilters,
} from '@modules/shared-ui';
import {
  Briefcase,
  MessageSquareText,
  FileText,
  SquarePen,
  Cog,
  Send,
  PlusCircle,
  Inbox,
  User,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { useUnreadCount } from '@modules/notifications/hooks/use-notifications';
import { isJobEtaExpired } from '@lib/utils';

const PER_PAGE = 12;

type FilterId = 'all' | 'Live' | 'Live Quote' | 'Quote' | 'Amend' | 'In Production' | 'Ready to Dispatch';
type SortOrder = 'newest' | 'oldest';

const PILL_DOT_COLORS: Record<Exclude<FilterId, 'all'>, string> = {
  Live: '#22c55e',
  'Live Quote': '#3b82f6',
  Quote: '#a855f7',
  Amend: '#f97316',
  'In Production': '#f59e0b',
  'Ready to Dispatch': '#14b8a6',
};

export function CSDashboardPage() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [extraFilters, setExtraFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const { jobs: allJobs } = useAdminJobViews({ per_page: 200 });
  const { data: unreadData } = useUnreadCount();
  // per_page: 500 — needed to populate the filter drawer's client dropdown with all client names.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const live = useMemo(() => allJobs.filter((j) => j.project === 'Live'), [allJobs]);
  const liveQuote = useMemo(() => allJobs.filter((j) => j.project === 'Live Quote'), [allJobs]);
  const quote = useMemo(() => allJobs.filter((j) => j.project === 'Quote'), [allJobs]);
  const amend = useMemo(() => allJobs.filter((j) => j.project === 'Amend'), [allJobs]);
  const inProduction = useMemo(() => allJobs.filter((j) => j.status === 'In Production'), [allJobs]);
  const readyToDispatch = useMemo(
    () => allJobs.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)),
    [allJobs],
  );
  const missedDeadlines = useMemo(() => allJobs.filter((j) => isJobEtaExpired(j)).length, [allJobs]);

  const pills: PillItem[] = [
    { id: 'all', label: 'All', count: allJobs.length },
    { id: 'Live', label: 'Live', count: live.length, dotColor: PILL_DOT_COLORS.Live },
    { id: 'Live Quote', label: 'Live Quote', count: liveQuote.length, dotColor: PILL_DOT_COLORS['Live Quote'] },
    { id: 'Quote', label: 'Quote', count: quote.length, dotColor: PILL_DOT_COLORS.Quote },
    { id: 'Amend', label: 'Amend', count: amend.length, dotColor: PILL_DOT_COLORS.Amend },
    { id: 'In Production', label: 'In Production', count: inProduction.length, dotColor: PILL_DOT_COLORS['In Production'] },
    { id: 'Ready to Dispatch', label: 'Ready to Dispatch', count: readyToDispatch.length, dotColor: PILL_DOT_COLORS['Ready to Dispatch'] },
  ];

  const pillFilteredJobs = useMemo(() => {
    switch (filter) {
      case 'Live': return live;
      case 'Live Quote': return liveQuote;
      case 'Quote': return quote;
      case 'Amend': return amend;
      case 'In Production': return inProduction;
      case 'Ready to Dispatch': return readyToDispatch;
      default: return allJobs;
    }
  }, [filter, allJobs, live, liveQuote, quote, amend, inProduction, readyToDispatch]);

  // Extra filter drawer (order type/priority/status/client) on top of the
  // pill filter, then sorted by creation date per the "Latest First" control.
  const filteredJobs = useMemo(() => {
    const withExtraFilters = applyJobFilters(pillFilteredJobs, extraFilters);
    return [...withExtraFilters].sort((a, b) => {
      const diff = new Date(b.created).getTime() - new Date(a.created).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  }, [pillFilteredJobs, extraFilters, sort]);

  // Reset to page 1 whenever the active filter/sort/pill selection changes,
  // so a stale page number from a longer list doesn't leave the view empty.
  useEffect(() => {
    setPage(1);
  }, [filter, extraFilters, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PER_PAGE));
  const pageJobs = useMemo(
    () => filteredJobs.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredJobs, page],
  );

  const csStats: CsStatCardProps[] = [
    {
      accent: 'cs-green',
      tag: 'Live',
      description: 'Direct Orders',
      value: live.length,
      statusText: 'Waiting Assignment',
      icon: <Briefcase />,
      href: '/cs/projects?project=Live',
    },
    {
      accent: 'cs-blue',
      tag: 'Live Quote',
      description: 'Quote Approved Jobs',
      value: liveQuote.length,
      statusText: 'Waiting Assignment',
      icon: <MessageSquareText />,
      href: '/cs/projects?project=Live+Quote',
    },
    {
      accent: 'cs-purple',
      tag: 'Quote',
      description: 'Awaiting Quote / Approval',
      value: quote.length,
      statusText: 'Pending Response',
      icon: <FileText />,
      href: '/cs/new-quotes',
    },
    {
      accent: 'cs-orange',
      tag: 'Amend',
      description: 'Revision Requested',
      value: amend.length,
      statusText: 'Pending Assignment',
      icon: <SquarePen />,
      href: '/cs/amendments',
    },
    {
      accent: 'cs-amber',
      tag: 'In Production',
      description: 'Jobs In Progress',
      value: inProduction.length,
      statusText: 'On Production',
      icon: <Cog />,
      href: '/cs/projects?filter=In+Production',
    },
    {
      accent: 'cs-teal',
      tag: 'Ready to Dispatch',
      description: 'Upload & Dispatch',
      value: readyToDispatch.length,
      statusText: 'Ready to Send',
      icon: <Send />,
      href: '/cs/deliver',
    },
  ];

  const overviewItems: OverviewItem[] = [
    { id: 'new-requests', label: 'New Requests', value: quote.length, href: '/cs/new-quotes', icon: <User className="w-3.5 h-3.5" />, accent: '#3b82f6' },
    { id: 'waiting-assignment', label: 'Waiting Assignment', value: live.length + liveQuote.length, href: '/cs/projects?project=Live', icon: <Briefcase className="w-3.5 h-3.5" />, accent: '#22c55e' },
    { id: 'waiting-reply', label: 'Waiting Client Reply', value: quote.length, href: '/cs/new-quotes', icon: <MessageSquareText className="w-3.5 h-3.5" />, accent: '#a855f7' },
    { id: 'in-production', label: 'In Production', value: inProduction.length, href: '/cs/projects?filter=In+Production', icon: <Cog className="w-3.5 h-3.5" />, accent: '#f97316' },
    { id: 'ready-to-dispatch', label: 'Ready to Dispatch', value: readyToDispatch.length, href: '/cs/deliver', icon: <Send className="w-3.5 h-3.5" />, accent: '#14b8a6' },
    { id: 'overdue', label: 'Overdue Jobs', value: missedDeadlines, tone: missedDeadlines > 0 ? 'danger' : 'default', href: '/cs/projects', icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const recentActivity: ActivityItem[] = useMemo(
    () =>
      [...allJobs]
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .slice(0, 5)
        .map((job) => {
          const { icon, accent } = activityIcon(job.status);
          return {
            id: job.id,
            icon,
            accent,
            title: job.status,
            subtitle: job.design,
            time: relativeTime(job.created),
          };
        }),
    [allJobs],
  );

  return (
    <div className="page">
      {/* CS 6-column stat strip */}
      <CsStatGrid stats={csStats} />

      <div className="two-col">
        <div>
          <div className="pills-control-bar">
            <div className="pills-scroll-wrapper">
              <Pills items={pills} activeId={filter} onSelect={(id) => setFilter(id as FilterId)} className="dashboard-pills mb-0" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pills-actions">
              <select
                className="filter-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                aria-label="Sort jobs"
              >
                <option value="newest">Latest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <button
                type="button"
                className={cn('filter-toggle-btn', showFilters && 'active')}
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
              >
                <SlidersHorizontal className="w-3 h-3" aria-hidden />
                Filter
              </button>
            </div>
          </div>

          {showFilters ? (
            <JobFilterBar
              filters={extraFilters}
              onChange={setExtraFilters}
              statusOptions={JOB_STATUS_OPTIONS}
              clients={clients}
              className="mb-3"
            />
          ) : null}

          <div className="mt-3">
            <JobTable jobs={pageJobs} showActions defaultView="grid" withControls={false} minimalColumns />
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredJobs.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>

        <div className="flex flex-col gap-3">
          <TodaysOverviewPanel items={overviewItems} viewAllHref="/cs/projects" />
          <RecentActivityPanel items={recentActivity} />
          <EmailInboxCta href="/cs/email-inbox" unreadCount={unreadData?.count ?? 0} />
        </div>
      </div>
    </div>
  );
}

function activityIcon(status: string): { icon: ReactNode; accent: string } {
  if (status === 'Quote Submitted') return { icon: <FileText className="w-3.5 h-3.5" />, accent: '#a855f7' };
  if (status === 'Order Placed') return { icon: <Inbox className="w-3.5 h-3.5" />, accent: '#3b82f6' };
  if (status === 'Dispatched') return { icon: <Send className="w-3.5 h-3.5" />, accent: '#22c55e' };
  return { icon: <PlusCircle className="w-3.5 h-3.5" />, accent: '#6366f1' };
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
