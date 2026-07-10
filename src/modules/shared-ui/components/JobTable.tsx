import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react';
import { JobDetailModal } from './JobDetailModal';
import { EditJobModal } from './EditJobModal';
import { AssignJobModal } from './AssignJobModal';
import {
  Inbox,
  Clock,
  CheckCircle2,
  Download,
  Search,
  X,
  Mail,
  MailOpen,
  Paintbrush,
  Sparkles,
  Layers,
  Scissors,
  Flag,
  Settings,
  Truck,
  RefreshCw,
  XCircle,
  Hash,
} from 'lucide-react';
import { useAdminJobById } from '@modules/admin-panel/hooks/use-admin-jobs';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
import { cn, briefText } from '@lib/utils';
import { jobImage, type Job } from '../mocks/jobs';

function statusDisplay(status: string): string {
  if (status === 'Pending Client Confirm' || status === 'Quote Approved') return 'Awaiting Client';
  return status;
}

type JobView = 'grid' | 'list' | 'table';

interface JobTableProps {
  jobs: Job[];
  /** UI Variant */
  variant?: 'default' | 'delivered';
  /** Default view; user can flip with the toggle. */
  defaultView?: JobView;
  /** Show built-in search input + view toggle (defaults true). */
  withControls?: boolean;
  /** Hide only the search input inside the controls bar (keeps the view toggle). */
  hideSearch?: boolean;
  /** Show the View/Edit action buttons on each row/card. */
  showActions?: boolean;
  /** Called when a row/card/list item is clicked. */
  onOpen?: (job: Job) => void;
  /** Override the row's Actions cell — runs the user's render fn instead. */
  renderActions?: (job: Job) => ReactNode;
  /** Empty-state copy when there are 0 jobs (after filter). */
  emptyLabel?: string;
  /** Extra elements rendered to the right of the view toggle (e.g. a Filter button). */
  controlsExtra?: ReactNode;
  /** Slot rendered on the LEFT of tbl-top (e.g. <JobFilterBar>) — view toggle stays right. */
  toolbarSlot?: ReactNode;
  /** Open the quote popup (Review & Set Price) from this table's View button. */
  quoteView?: boolean;
  /** Job UUID/id to auto-open on mount (e.g. deep-linked from a notification). */
  initialOpenJobId?: string | null;
  /** Called once the initialOpenJobId has been consumed (e.g. to clear a URL param). */
  onInitialOpenHandled?: () => void;
  /** Compact 5-column table for dashboard widgets — no preview, timer, or date. */
  compact?: boolean;
  /** Number of columns for large screens in grid view */
  gridCols?: 3 | 4;
}

/**
 * Toggle-able job listing — table / grid / list views matching the demo's
 * `jobTable()` helper. Owns its own search + view state.
 */
export function JobTable({
  jobs,
  defaultView = 'grid',
  variant = 'default',
  withControls = true,
  hideSearch = false,
  showActions = false,
  onOpen,
  renderActions,
  emptyLabel = 'No jobs found',
  controlsExtra,
  toolbarSlot,
  quoteView = false,
  initialOpenJobId,
  onInitialOpenHandled,
  compact = false,
  gridCols = 4,
}: JobTableProps) {
  const [view, setView] = useState<JobView>(defaultView);
  const [query, setQuery] = useState('');
  // Store only the identifier. The modal uses a live detail fetch (useAdminJobById)
  // so it always gets fresh data including modification_notes and any field that
  // the list endpoint doesn't return. Falls back to the list-derived copy while
  // the detail fetch is in-flight so the modal opens instantly.
  const [viewJobId, setViewJobId] = useState<string | null>(null);

  useEffect(() => {
    if (initialOpenJobId) {
      setViewJobId(initialOpenJobId);
      onInitialOpenHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenJobId]);
  const listJob = useMemo(
    () => (viewJobId ? (jobs.find((j) => (j.uuid ?? j.id) === viewJobId) ?? null) : null),
    [viewJobId, jobs],
  );
  const { data: detailJob } = useAdminJobById(viewJobId ?? '');
  const viewJob = detailJob ?? listJob;
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [assignJob, setAssignJob] = useState<Job | null>(null);

  const handleOpen = useCallback((job: Job) => {
    if (onOpen) { onOpen(job); } else { setViewJobId(job.uuid ?? job.id); }
  }, [onOpen]);

  const builtInActions = useCallback((j: Job) => (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setViewJobId(j.uuid ?? j.id)}
        aria-label={`View ${j.id}`}
      >
        View
      </button>
    </div>
  ), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.id, j.ref, j.client, j.design, j.summary, j.order, j.status, j.priority]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [jobs, query]);

  const renderRowActions = renderActions ?? (showActions ? builtInActions : undefined);

  return (
    <div className={variant === 'delivered' ? 'w-full' : 'jobs-root'} data-view={view}>
      {withControls ? (
        <div className="tbl-top">
          {/* Inner row: search/filter-bar + view toggle always on same line */}
          <div className="tbl-top-row">
            {/* Left slot: external filter bar OR built-in search */}
            {toolbarSlot ? (
              <div className="tbl-toolbar-slot">{toolbarSlot}</div>
            ) : !hideSearch ? (
              <div className="tbl-search-wrap">
                <Search className="tbl-search-icon" aria-hidden />
                <input
                  type="text"
                  className="tbl-search"
                  style={{ paddingRight: query ? 28 : undefined }}
                  placeholder="Search jobs, clients, designs..."
                  value={query}
                  maxLength={500}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search jobs"
                />
                {query && (
                  <button
                    type="button"
                    className="fjb-search-x"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ) : null}
            {/* Right: view toggle */}
            <div className="view-toggle tbl-toggle-right" role="tablist" aria-label="Job views">
              {(['grid', 'list', 'table'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={cn(
                    view === v && 'on',
                    v === 'table' && 'hidden md:inline-block'
                  )}
                  onClick={() => setView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {controlsExtra}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : compact ? (
        <CompactTableView jobs={filtered} onOpen={handleOpen} renderRowActions={renderRowActions} />
      ) : variant === 'delivered' ? (
        <DeliveredView jobs={filtered} renderRowActions={renderRowActions} />
      ) : (
        <>
          <TableView
            jobs={filtered}
            onOpen={handleOpen}
            renderRowActions={renderRowActions}
            className={cn(view === 'table' ? 'hidden md:block' : 'hidden')}
          />
          <GridView
            jobs={filtered}
            onOpen={handleOpen}
            renderRowActions={renderRowActions}
            gridCols={gridCols}
            className={cn(
              view === 'grid' && "grid",
              view === 'table' && "grid md:hidden",
              view === 'list' && "hidden"
            )}
          />
          <ListView
            jobs={filtered}
            onOpen={handleOpen}
            renderRowActions={renderRowActions}
            className={cn(view === 'list' ? 'block' : 'hidden')}
          />
        </>
      )}
      {viewJob && (
        <JobDetailModal
          job={viewJob}
          onClose={() => setViewJobId(null)}
          onEdit={(j) => { setViewJobId(null); setEditJob(j); }}
          onAssign={(j) => { setViewJobId(null); setAssignJob(j); }}
          quoteView={quoteView}
        />
      )}
      {editJob && (
        <EditJobModal
          job={editJob}
          onClose={() => setEditJob(null)}
          onBack={(j) => { setEditJob(null); setViewJobId(j.uuid ?? j.id); }}
        />
      )}
      {assignJob && (
        <AssignJobModal
          job={assignJob}
          onClose={() => setAssignJob(null)}
        />
      )}
    </div>
  );
}

function CompactTableView({
  jobs,
  onOpen,
  renderRowActions,
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
}) {
  return (
    <div className="compact-table-wrap">
      <table className="compact-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Design</th>
            <th>Order</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => onOpen?.(j)}>
              <td><span className="compact-ref">{j.ref || j.id}</span></td>
              <td><span className="compact-design">{j.design}</span></td>
              <td><span className={cn('badge', orderBadgeAccent(j.order))}>{j.order}</span></td>
              <td><span className={cn('badge', projectTypeBadgeAccent(j.project))}>{projectTypeBadgeLabel(j.project, j.modificationCount)}</span></td>
              <td><PriorityChip priority={j.priority} /></td>
              <td><span className={cn('badge', statusBadgeAccent(j.status))}>{statusDisplay(j.status)}</span></td>
              <td onClick={(e) => e.stopPropagation()}>
                {renderRowActions ? renderRowActions(j) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => onOpen?.(j)}
                  >
                    View
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveredView({
  jobs,
  renderRowActions,
}: {
  jobs: Job[];
  renderRowActions?: (job: Job) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {jobs.map((job) => (
        <div key={job.id} className="panel !mb-0 !p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="jc-id">{job.id}</span>
                {/* Order/project type badge commented out per user request:
                {job.project === 'Amend' ? (
                  <>
                    <Badge accent="crimson">
                      Amend{job.modificationCount ? ` R${job.modificationCount}` : ''}
                    </Badge>
                    {job.status !== 'Amend' && (
                      <Badge accent={statusBadgeAccent(job.status)}>{statusDisplay(job.status)}</Badge>
                    )}
                  </>
                ) : (
                  <Badge accent={statusBadgeAccent(job.status)}>{statusDisplay(job.status)}</Badge>
                )}
                <Badge accent={projectTypeBadgeAccent(job.project)}>
                  {job.project.toUpperCase()}
                </Badge>
                */}
                <Badge accent={statusBadgeAccent(job.status)}>{statusDisplay(job.status)}</Badge>
              </div>
              <div className="text-[15px] font-bold text-text-main line-clamp-2 break-words">{job.design}</div>
              <div className="text-[12px] text-text-muted mt-0.5">
                Order Type: {job.order} &middot; Assigned: {job.assignedTo || 'Unassigned'}
              </div>
            </div>
            <div className="text-right mt-3 sm:mt-0">
              <div className="text-[11px] text-text-faint uppercase tracking-wider mb-0.5">Created</div>
              <div className="text-[13px] font-bold text-text-muted">{formatDate(job.created)}</div>
            </div>
          </div>

          <div className="border-t border-[var(--glass-border)] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-[13px] text-text-muted">
              {briefText(job.summary)}
            </div>
            <div className="flex-shrink-0">
              {renderRowActions ? renderRowActions(job) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-text-faint">
      <Inbox aria-hidden className="w-5 h-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function statusBadgeAccent(status: string): string {
  const map: Record<string, string> = {
    'In QC': 'teal',
    'In Production': 'amber',
    Pending: 'blue',
    'Senior Review': 'purple',
    Sewout: 'purple',
    'Ready to Deliver': 'teal',
    Dispatched: 'green',
    'Quote Submitted': 'blue',
    'Quote Approved': 'amber',
    'Pending Client Confirm': 'amber',
    Cancelled: 'gray',
    Amend: 'amber',
    'In Review': 'purple',
    'On Hold': 'red',
  };
  return map[status] || 'gray';
}

function orderBadgeAccent(order: string): string {
  return order === 'Digitizing' ? 'teal' : 'navy';
}

/** Accent colour for the project-type badge (Quote / Live / Amend / Live Quote). */
function projectTypeBadgeAccent(project: string): string {
  const map: Record<string, string> = {
    Quote: 'purple',
    'Live Quote': 'green',
    Live: 'blue',
    Amend: 'amber',
  };
  return map[project] || 'gray';
}

/** Display label for the project-type badge — shows revision number for Amend jobs. */
function projectTypeBadgeLabel(project: string, modificationCount?: number | null): string {
  if (project === 'Amend' && modificationCount && modificationCount > 0) {
    return `Amend R${modificationCount}`;
  }
  return project;
}


function priorityClass(priority: string): string {
  const map: Record<string, string> = {
    Normal: 'normal',
    Rush: 'rush',
    'Super Rush': 'super-rush',
  };
  return map[priority] || 'normal';
}

function priorityCardClass(priority: string): string {
  const map: Record<string, string> = {
    Normal: 'job-card-normal',
    Rush: 'job-card-rush',
    'Super Rush': 'job-card-super-rush',
  };
  return map[priority] || 'job-card-normal';
}

function Badge({ children, accent }: { children: ReactNode; accent: string }) {
  return <span className={cn('badge', accent)}>{children}</span>;
}

function PriorityChip({ priority }: { priority: string }) {
  return <span className={cn('priority-badge', priorityClass(priority))}>{priority}</span>;
}

const ORDINALS = ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];

/** Subtitle line under the image explaining how this card entered the pipeline. */
function sourceSubtitleFor(project: string, modificationCount?: number | null): string {
  switch (project) {
    case 'Quote':
      return 'New Quote';
    case 'Live Quote':
      return 'Live Quote (Quote Converted)';
    case 'Amend': {
      const n = modificationCount && modificationCount > 0 ? modificationCount : 1;
      const ordinal = ORDINALS[n] ?? `${n}th`;
      return `Amend R${n} (${ordinal} Amendment)`;
    }
    case 'Live':
    default:
      return 'Live Job (Direct)';
  }
}

/** Icon for the Department info row, keyed by order/department type. */
function departmentIconFor(order: string) {
  const map: Record<string, typeof Paintbrush> = {
    Artwork: Paintbrush,
    Digitizing: Sparkles,
    'Digitizing + Sewout': Layers,
    Sewout: Scissors,
  };
  return map[order] ?? Paintbrush;
}

/** Icon for the Status info row, keyed by pipeline stage. */
function statusIconFor(status: string) {
  const inProduction = new Set(['In Production', 'Senior Review', 'Sewout', 'In QC']);
  if (status === 'Dispatched' || status === 'Ready to Deliver') return Truck;
  if (inProduction.has(status)) return Settings;
  if (status === 'On Hold') return Clock;
  if (status === 'Cancelled') return XCircle;
  if (status === 'Amend' || status === 'In Review') return RefreshCw;
  return Clock;
}

function ReadBadge({ isRead }: { isRead?: boolean }) {
  const Icon = isRead ? MailOpen : Mail;
  return (
    <span className={cn('jc-read-badge', isRead ? 'is-read' : 'is-unread')}>
      <Icon className="w-3 h-3" aria-hidden />
      {isRead ? 'READ' : 'UNREAD'}
    </span>
  );
}

/** Icon-labelled info row (Department / Priority / Status / Job ID) used in the redesigned card. */
function InfoRow({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: typeof Hash;
  label: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div className="jc-info-row">
      <span className="jc-info-label">
        <span className={cn('jc-info-icon', accent)}>
          <Icon className="w-3 h-3" aria-hidden />
        </span>
        {label}
      </span>
      {children}
    </div>
  );
}

function TableView({
  jobs,
  onOpen,
  renderRowActions,
  className,
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("table-view", className)}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Design Name</th>
            <th>Preview</th>
            <th>Order</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className={priorityCardClass(j.priority)} onClick={() => onOpen?.(j)}>
              <td>
                <div className="job-cell">
                  <div>
                    <span className="ref-code">{j.id}</span>
                    <div className="text-[10.5px] text-text-muted font-medium mt-0.5">{j.ref}</div>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className="font-bold text-[14px] text-text-main block"
                  title={j.design}
                  style={{
                    maxWidth: 120,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {j.design}
                </span>
              </td>
              <td>
                <img
                  className="table-preview"
                  src={jobImage(j, 0, 220, 160)}
                  alt={`${j.design} preview`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              </td>
              <td><Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge></td>
              <td><Badge accent={projectTypeBadgeAccent(j.project)}>{projectTypeBadgeLabel(j.project, j.modificationCount)}</Badge></td>
              <td><PriorityChip priority={j.priority} /></td>
              <td><Badge accent={statusBadgeAccent(j.status)}>{j.status}</Badge></td>
              <td className="text-[12px] text-text-muted whitespace-nowrap">{formatDate(j.created)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                {renderRowActions ? renderRowActions(j) : (
                  j.stage === 'delivered' ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}
                      onClick={() => onOpen?.(j)}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden />
                      Download
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => onOpen?.(j)}
                    >
                      View
                    </button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridView({
  jobs,
  onOpen,
  renderRowActions,
  className,
  gridCols = 4,
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
  gridCols?: 3 | 4;
}) {
  return (
    <div className={cn("grid-view grid grid-cols-2 md:grid-cols-3 gap-2.5 py-2", gridCols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4", className)}>
      {jobs.map((j) => {
        const actionRequired = j.status === 'Pending Client Confirm' || j.status === 'Quote Approved';
        const agencyPrice = j.negotiation?.agencyOffer ?? j.adminPrice ?? null;
        const DeptIcon = departmentIconFor(j.order);
        const StatusIcon = statusIconFor(j.status);
        const category = [j.order, j.process ?? j.complexity].filter(Boolean).join(' • ');
        return (
          <article
            key={j.id}
            className={cn('job-card', priorityCardClass(j.priority), actionRequired && 'job-card-attention')}
            onClick={() => onOpen?.(j)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.(j);
              }
            }}
          >
            <div className="jc-header">
              <span className={cn('badge whitespace-nowrap', projectTypeBadgeAccent(j.project))}>
                {projectTypeBadgeLabel(j.project, j.modificationCount)}
              </span>
              <ReadBadge isRead={j.isRead} />
            </div>
            <div className="jc-img">
              {j.images?.length ? (
                <img
                  className="w-full h-[90px] md:h-[110px] object-contain block"
                  src={j.images[0]}
                  alt={j.design}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              ) : (
                <div className="w-full h-[160px]" />
              )}
            </div>
            <div className="jc-body">
              <div className={cn('jc-subtitle', projectTypeBadgeAccent(j.project))}>
                <span className="jc-subtitle-dot" aria-hidden />
                {sourceSubtitleFor(j.project, j.modificationCount)}
              </div>
              <div className="jc-title" title={j.design}>{j.design}</div>
              {category ? <div className="jc-category">{category}</div> : null}
              <div className="jc-info-rows">
                <InfoRow icon={DeptIcon} label="Department" accent={orderBadgeAccent(j.order)}>
                  <Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge>
                </InfoRow>
                <InfoRow icon={Flag} label="Priority">
                  <PriorityChip priority={j.priority} />
                </InfoRow>
                <InfoRow icon={StatusIcon} label="Status">
                  <Badge accent={statusBadgeAccent(j.status)}>{statusDisplay(j.status)}</Badge>
                </InfoRow>
                <InfoRow icon={Hash} label="Job ID">
                  <span className="jc-id">{j.id}</span>
                </InfoRow>
              </div>
              {actionRequired ? (
                <div className="jc-action">
                  <CheckCircle2 aria-hidden className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>
                    Quote sent{agencyPrice ? ` — $${agencyPrice}` : ''} ·{' '}
                    <strong>Awaiting client confirmation</strong>
                  </span>
                </div>
              ) : null}
              <div className="jc-footer">
                {renderRowActions ? renderRowActions(j) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen?.(j);
                    }}
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ListView({
  jobs,
  onOpen,
  renderRowActions,
  className,
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("list-view pt-1", className)}>
      {jobs.map((j) => (
        <div
          key={j.id}
          className={cn('job-list-item', priorityCardClass(j.priority))}
          onClick={() => onOpen?.(j)}
          role="button"
          tabIndex={0}
        >
          {/* Thumbnail */}
          <div className="list-thumb">
            <img
              src={jobImage(j, 0, 128, 128)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
          </div>

          {/* Main body */}
          <div className="list-body">
            {/* Title row with badges */}
            <div className="list-title-row">
              <span className="list-title">{j.design}</span>
              <div className="list-badges">
                <Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge>
                <Badge accent={projectTypeBadgeAccent(j.project)}>{projectTypeBadgeLabel(j.project, j.modificationCount)}</Badge>
                <Badge accent={statusBadgeAccent(j.status)}>{statusDisplay(j.status)}</Badge>
              </div>
            </div>

            {/* Ref + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="list-ref">{j.ref || j.id}</span>
              <PriorityChip priority={j.priority} />
              {j.specificType && (
                <>
                  <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>·</span>
                  <span className="list-meta">{j.specificType}</span>
                </>
              )}
            </div>

            {/* Description */}
            {briefText(j.summary) && (
              <div className="list-desc">{briefText(j.summary)}</div>
            )}

            {/* Actions */}
            {renderRowActions && (
              <div
                className="flex items-center gap-2 mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {renderRowActions(j)}
              </div>
            )}
          </div>

          {/* Right — date + ETA */}
          <div className="list-right">
            <div className="list-date">{formatDate(j.created)}</div>
            {j.etaHours ? (
              <div className="list-eta">
                <Clock className="w-3 h-3 stroke-[2.2]" />
                <span>{j.etaHours}h</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
