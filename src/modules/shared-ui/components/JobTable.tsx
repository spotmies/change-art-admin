import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react';
import { JobDetailModal } from './JobDetailModal';
import { EditJobModal } from './EditJobModal';
import { AssignJobModal } from './AssignJobModal';
import { RowActionsMenu, type RowAction } from './RowActionsMenu';
import {
  Inbox,
  Clock,
  CheckCircle2,
  Download,
  Search,
  X,
  Paintbrush,
  Sparkles,
  Layers,
  Scissors,
  Flag,
  Zap,
  Settings,
  Truck,
  RefreshCw,
  XCircle,
  Eye,
  Pencil,
  UserPlus,
} from 'lucide-react';
import { useAdminJobById } from '@modules/admin-panel/hooks/use-admin-jobs';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

/** Compact relative timestamp for job cards, e.g. "5m ago" / "3h ago" / "2d ago". */
function relativeTimeShort(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
import { cn, briefText } from '@lib/utils';
import { jobImage, type Job } from '../mocks/jobs';
import { CompletedStatusBadge, isCompletedStatus } from './StatusBadge';

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
  /** Table view only: hide the Job ref, Created date, and Action columns — dashboard widgets only. */
  minimalColumns?: boolean;
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
  minimalColumns = false,
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

  const builtInActions = useCallback((j: Job) => {
    const showAssign = !j.assignedTo && j.stage !== 'delivered' && j.stage !== 'quote';
    const isReadyToDispatch = j.status === 'Ready to Deliver';
    const needsQuotePrep = j.status === 'Quote Submitted';
    const isQuoteAwaiting = j.project === 'Quote' || j.status === 'Quote Submitted';
    const showDispatch = j.stage !== 'delivered' && j.stage !== 'quote';
    return (
      <div className="job-actions flex gap-1 flex-nowrap flex-1 items-center w-full min-w-0" onClick={(e) => e.stopPropagation()}>
        {showAssign ? (
          <button
            type="button"
            className="btn font-bold flex-1 min-w-0"
            style={{ fontSize: 10, padding: '0 5px', background: stageAccentColor(j.project), color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
            onClick={() => setAssignJob(j)}
            aria-label={`Assign ${j.id}`}
          >
            Assign
          </button>
        ) : null}
        {needsQuotePrep ? (
          <button
            type="button"
            className="btn font-bold flex-1 min-w-0"
            style={{ fontSize: 10, padding: '0 5px', background: stageAccentColor(j.project), color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
            onClick={() => setViewJobId(j.uuid ?? j.id)}
            aria-label={`Prepare quote for ${j.id}`}
          >
            Prepare Quote
          </button>
        ) : null}
        {isReadyToDispatch ? (
          <button
            type="button"
            className="btn font-bold flex-1 min-w-0"
            style={{ fontSize: 10, padding: '0 5px', background: DISPATCH_ACCENT, color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
            onClick={() => setViewJobId(j.uuid ?? j.id)}
            aria-label={`Upload files for ${j.id}`}
          >
            Upload
          </button>
        ) : null}
        {showDispatch ? (
          <button
            type="button"
            className={isReadyToDispatch ? 'btn font-bold flex-1 min-w-0' : 'btn btn-outline font-bold flex-1 min-w-0'}
            style={
              isReadyToDispatch
                ? { fontSize: 10, padding: '0 5px', background: DISPATCH_ACCENT, color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }
                : { fontSize: 10, padding: '0 5px', height: 25, borderRadius: 5, whiteSpace: 'nowrap', ...stageOutlineStyle(j.project) }
            }
            onClick={() => setViewJobId(j.uuid ?? j.id)}
            aria-label={`Dispatch ${j.id}`}
          >
            Dispatch
          </button>
        ) : null}
        {isReadyToDispatch ? null : (
          <button
            type="button"
            className="btn btn-outline font-bold flex-1 min-w-0"
            style={{ fontSize: 10, padding: '0 5px', height: 25, borderRadius: 5, whiteSpace: 'nowrap', ...stageOutlineStyle(j.project) }}
            onClick={() => setViewJobId(j.uuid ?? j.id)}
            aria-label={`${isQuoteAwaiting ? 'Reply' : 'View'} ${j.id}`}
          >
            {isQuoteAwaiting ? 'Reply' : 'View'}
          </button>
        )}
        <RowActionsMenu
          ariaLabel={`More actions for ${j.id}`}
          triggerClassName="!flex-shrink-0 !flex-grow-0 flex items-center justify-center !p-0 !border-none !bg-transparent text-text-muted hover:text-text-main"
          triggerStyle={{ height: 25, width: 20, minWidth: 20, maxWidth: 20, flex: '0 0 20px', border: 'none', background: 'transparent' }}
          actions={
            [
              { key: 'view', label: 'View Details', icon: <Eye className="w-3.5 h-3.5" aria-hidden />, onSelect: () => setViewJobId(j.uuid ?? j.id) },
              { key: 'edit', label: 'Edit Job', icon: <Pencil className="w-3.5 h-3.5" aria-hidden />, onSelect: () => setEditJob(j) },
              ...(!j.assignedTo && j.stage !== 'delivered' && j.stage !== 'quote'
                ? [{ key: 'assign', label: 'Assign Job', icon: <UserPlus className="w-3.5 h-3.5" aria-hidden />, onSelect: () => setAssignJob(j) }]
                : []),
            ] satisfies RowAction[]
          }
        />
      </div>
    );
  }, []);

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
            minimalColumns={minimalColumns}
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
              <td>{isCompletedStatus(j.status, j.stage) ? <CompletedStatusBadge label="Matched" /> : <span className={cn('badge', statusBadgeAccent(j.status))}>{statusDisplay(j.status)}</span>}</td>
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
                {isCompletedStatus(job.status, job.stage) ? <CompletedStatusBadge label="Matched" /> : <Badge accent={statusBadgeAccent(job.status)}>{statusDisplay(job.status)}</Badge>}
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
  return (
    <span className={cn('priority-badge', priorityClass(priority))}>
      {priority === 'Normal' ? (
        <Flag className="w-3 h-3 shrink-0" aria-hidden />
      ) : (
        <Zap className="w-3 h-3 shrink-0" aria-hidden />
      )}
      {priority}
    </span>
  );
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

/**
 * Deterministic "how far through the pipeline" percentage, derived from the
 * job's real stage — there's no stored progress field on the backend model,
 * so this is computed rather than read off a (nonexistent) `job.progress`.
 */
function stageProgressPercent(stage: Job['stage'], status?: Job['status'] | string): number | null {
  switch (stage) {
    case 'junior': return 25;
    case 'senior': return 50;
    case 'qc': return 75;
    case 'sewout': return 90;
    case 'delivered': return 100;
    default: {
      const s = String(status ?? '');
      if (s === 'In Production' || s === 'CS Approved' || s === 'Assigned') return 25;
      if (s === 'QC Rejected' || s === 'Senior Rejected' || s === 'In QC' || s === 'Senior Review') return 75;
      if (s === 'Ready to Deliver') return 90;
      if (s === 'Completed' || s === 'Dispatched') return 100;
      return null;
    }
  }
}

function formatEtaDisplay(startIso?: string | null, etaHours?: number | null): string | null {
  const hours = etaHours && etaHours > 0 ? etaHours : 4;
  const startMs = startIso ? new Date(startIso).getTime() : Date.now();
  if (isNaN(startMs)) return null;
  const end = new Date(startMs + hours * 60 * 60 * 1000);
  
  const today = new Date();
  const isToday = end.getDate() === today.getDate() &&
                  end.getMonth() === today.getMonth() &&
                  end.getFullYear() === today.getFullYear();
                  
  const timeStr = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today ${timeStr}`;
  }
  const dateStr = end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

function TableView({
  jobs,
  onOpen,
  renderRowActions,
  className,
  minimalColumns = false,
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
  /** Hide the Job ref, Created date, and Action columns — dashboard widgets only. */
  minimalColumns?: boolean;
}) {
  return (
    <div className={cn("table-view", minimalColumns && "minimal-columns", className)}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Design Name</th>
            {/* <th>Preview</th> */}
            <th>Order</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            {!minimalColumns && <th>Created</th>}
            {!minimalColumns && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className={priorityCardClass(j.priority)} onClick={() => onOpen?.(j)}>
              <td>
                <div className="job-cell">
                  <div>
                    <span className="ref-code">{j.ref}</span>
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
              {/* <td>
                <img
                  className="table-preview"
                  src={jobImage(j, 0, 220, 160)}
                  alt={`${j.design} preview`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              </td> */}
              <td><Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge></td>
              <td><Badge accent={projectTypeBadgeAccent(j.project)}>{projectTypeBadgeLabel(j.project, j.modificationCount)}</Badge></td>
              <td><PriorityChip priority={j.priority} /></td>
              <td>{isCompletedStatus(j.status, j.stage) ? <CompletedStatusBadge label="Matched" /> : <Badge accent={statusBadgeAccent(j.status)}>{j.status}</Badge>}</td>
              {!minimalColumns && (
                <td className="text-[12px] text-text-muted whitespace-nowrap">{formatDate(j.created)}</td>
              )}
              {!minimalColumns && (
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
              )}
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
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
  gridCols?: 3 | 4;
}) {
  return (
    <div className={cn("grid-view-container min-w-0", className)}>
      <div className="grid-view">
      {jobs.map((j) => {
        const actionRequired = j.status === 'Pending Client Confirm' || j.status === 'Quote Approved';
        const agencyPrice = j.negotiation?.agencyOffer ?? j.adminPrice ?? null;
        const DeptIcon = departmentIconFor(j.order);
        const StatusIcon = statusIconFor(j.status);

        const isInProd = j.status === 'In Production' || j.stage === 'junior' || j.stage === 'senior' || j.stage === 'qc' || j.stage === 'sewout';
        const isReadyDispatch = j.status === 'Ready to Deliver';
        const titleClass = getTitleColorClass(j.project, j.status);
        const stageCardClass = getStageCardClass(j.project, j.status);
        const progress = stageProgressPercent(j.stage, j.status);

        return (
          <article
            key={j.id}
            className={cn('job-card min-w-0', stageCardClass, priorityCardClass(j.priority), actionRequired && 'job-card-attention')}
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
            {/* Card Header: Project type badge + Job Ref + timestamp */}
            <div className="jc-header px-2.5 pt-2 pb-0.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                <span className={cn('badge whitespace-nowrap flex-shrink-0 !text-[9px] !px-1.5 !py-[1px]', projectTypeBadgeAccent(j.project))}>
                  {projectTypeBadgeLabel(j.project, j.modificationCount)}
                </span>
                {j.ref && (
                  <span
                    className="jc-ref font-mono font-bold text-[9px] text-[#334155] dark:text-[#cbd5e1] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis flex-shrink-0"
                    title={j.ref}
                  >
                    {j.ref}
                  </span>
                )}
              </div>
              <span className="jc-header-meta flex-shrink-0">
                <span className="jc-time text-[9px] text-text-muted">{relativeTimeShort(j.created)}</span>
              </span>
            </div>

            {/* Card Body - Top Metadata Section */}
            <div className="jc-body px-2.5 pb-2 pt-1 flex flex-col flex-1 gap-1">
              {/* Job title — colored by project type */}
              <div className={cn('jc-title font-bold text-[13px] leading-tight truncate', titleClass)} title={j.design}>{j.design}</div>

              {/* Client name */}
              {j.client ? <div className="jc-client font-semibold text-[11.5px] leading-tight text-[#0D1B2A] -mt-0.5">{j.client}</div> : null}

              {/* Info rows: Dept + Priority */}
              <div className="flex items-center gap-2 text-[9.5px] font-semibold">
                <div className="flex items-center gap-1 text-text-main">
                  <DeptIcon className="w-3 h-3 text-text-muted shrink-0" aria-hidden />
                  {j.order}
                </div>
                <span className={cn('priority-badge !text-[9px] !px-1.5 !py-[1px]', priorityClass(j.priority))}>
                  {j.priority === 'Normal' ? (
                    <Flag className="w-2.5 h-2.5 shrink-0" aria-hidden />
                  ) : (
                    <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden />
                  )}
                  {j.priority}
                </span>
              </div>

              {/* Info row: Status */}
              <div className="flex items-center gap-1 text-[9.5px] font-bold text-slate-700 dark:text-slate-300">
                {isCompletedStatus(j.status, j.stage) ? (
                  <CompletedStatusBadge label="Matched" />
                ) : (
                  <>
                    <StatusIcon className="w-3 h-3 shrink-0" aria-hidden />
                    <span className={cn('font-bold', statusBadgeAccent(j.status) === 'green' ? 'text-green-600 dark:text-green-400' : statusBadgeAccent(j.status) === 'amber' ? 'text-amber-600 dark:text-amber-400' : statusBadgeAccent(j.status) === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200')}>
                      {statusDisplay(j.status)}
                    </span>
                  </>
                )}
              </div>

              {/* Progress section — label, bar, and percentage indicator ALL on the SAME flex line */}
              {isInProd && progress != null ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9.5px] text-text-muted font-medium shrink-0">Progress</span>
                  <div className="flex-1 h-1.5 bg-slate-200/70 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-900 dark:text-slate-100 shrink-0">{progress}%</span>
                </div>
              ) : null}

              {/* ETA Completion Time row */}
              {isInProd && (
                <div className="text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 -mt-0.5">
                  ETA: <span className="font-bold text-slate-900 dark:text-slate-100">{formatEtaDisplay(j.effectiveAcknowledgedAt ?? j.acknowledgedAt ?? j.created, j.etaHours)}</span>
                </div>
              )}

              {/* Action-required callout */}
              {actionRequired ? (
                <div className="jc-action mt-1">
                  <CheckCircle2 aria-hidden className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>
                    Quote sent{agencyPrice ? ` — $${agencyPrice}` : ''} ·{' '}
                    <strong>Awaiting client confirmation</strong>
                  </span>
                </div>
              ) : null}
            </div>

            {/* Image area - Middle */}
            <div className="jc-img" style={{ padding: '3px 6px 2px' }}>
              {j.images?.length ? (
                <img
                  className="w-full object-cover block rounded-md border border-[rgba(0,0,0,0.05)]"
                  style={{ height: 120 }}
                  src={j.images[0]}
                  alt={j.design}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              ) : (
                <div className="w-full rounded-md border border-[rgba(0,0,0,0.05)]" style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* Footer actions — single row flex-nowrap */}
            <div className="jc-footer flex gap-1 p-1.5 border-t border-[rgba(0,0,0,0.06)]" onClick={(e) => e.stopPropagation()}>
              {renderRowActions ? renderRowActions(j) : (
                <div className="flex gap-1 flex-nowrap flex-1 items-center w-full min-w-0">
                  {/* Assign button */}
                  {!j.assignedTo && j.stage !== 'delivered' && j.stage !== 'quote' && (
                    <button
                      type="button"
                      className="btn font-bold flex-1 min-w-0"
                      style={{ fontSize: 10, padding: '0 5px', background: stageAccentColor(j.project), color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      Assign
                    </button>
                  )}
                  {/* Upload Files button — ready-to-dispatch jobs only. */}
                  {isReadyDispatch && (
                    <button
                      type="button"
                      className="btn font-bold flex-1 min-w-0"
                      style={{ fontSize: 10, padding: '0 5px', background: DISPATCH_ACCENT, color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      Upload
                    </button>
                  )}
                  {/* Dispatch button */}
                  {j.stage !== 'delivered' && j.stage !== 'quote' && (
                    <button
                      type="button"
                      className={isReadyDispatch ? 'btn font-bold flex-1 min-w-0' : 'btn btn-outline font-bold flex-1 min-w-0'}
                      style={
                        isReadyDispatch
                          ? { fontSize: 10, padding: '0 5px', background: DISPATCH_ACCENT, color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }
                          : { fontSize: 10, padding: '0 5px', height: 25, borderRadius: 5, whiteSpace: 'nowrap', ...stageOutlineStyle(j.project) }
                      }
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      Dispatch
                    </button>
                  )}
                  {/* Prepare Quote button */}
                  {(j.project === 'Quote' && (j.status === 'Pending' || j.stage === 'quote')) && (
                    <button
                      type="button"
                      className="btn font-bold flex-1 min-w-0"
                      style={{ fontSize: 10, padding: '0 5px', background: stageAccentColor(j.project), color: '#fff', border: 'none', height: 25, borderRadius: 5, whiteSpace: 'nowrap' }}
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      Prepare Quote
                    </button>
                  )}
                  {/* Reply button */}
                  {(j.project === 'Quote' || j.status === 'Quote Submitted' || j.project === 'Amend') && (
                    <button
                      type="button"
                      className="btn btn-outline font-bold flex-1 min-w-0"
                      style={{ fontSize: 10, padding: '0 5px', height: 25, borderRadius: 5, whiteSpace: 'nowrap', ...stageOutlineStyle(j.project) }}
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      Reply
                    </button>
                  )}
                  {/* View / View Progress button */}
                  {!isReadyDispatch && (
                    <button
                      type="button"
                      className="btn btn-outline font-bold flex-1 min-w-0"
                      style={{ fontSize: 10, padding: '0 5px', height: 25, borderRadius: 5, whiteSpace: 'nowrap', ...stageOutlineStyle(j.project) }}
                      onClick={(e) => { e.stopPropagation(); onOpen?.(j); }}
                    >
                      {isInProd ? 'Progress' : 'View'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}

/** Returns the CSS class for colored job title based on project type (Quote/Live Quote/Live/Amend). */
function getTitleColorClass(project: string, _status: string): string {
  switch (project) {
    case 'Live': return 'jc-title-live';
    case 'Live Quote': return 'jc-title-live-quote';
    case 'Quote': return 'jc-title-quote';
    case 'Amend': return 'jc-title-amend';
    default: return '';
  }
}

/** Returns the CSS class that tints the whole job card by project type — always matches the title/badge colour, regardless of stage/status. */
function getStageCardClass(project: string, _status: string): string {
  switch (project) {
    case 'Live': return 'job-card-stage-live';
    case 'Live Quote': return 'job-card-stage-live-quote';
    case 'Quote': return 'job-card-stage-quote';
    case 'Amend': return 'job-card-stage-amend';
    default: return '';
  }
}

/** Solid accent colour matching the job card's project-type tint (jc-title-* / job-card-stage-*), used to colour the primary CTA button on each card. */
function stageAccentColor(project: string): string {
  switch (project) {
    case 'Live': return '#2563eb';
    case 'Live Quote': return '#16a34a';
    case 'Quote': return '#7c3aed';
    case 'Amend': return '#ea580c';
    default: return '#4F46E5';
  }
}

/** Teal accent used for the "Ready to Dispatch" stage — matches job-card-stage-dispatch / jc-title-dispatch. */
const DISPATCH_ACCENT = '#0d9488';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Tinted style for secondary (outline) buttons on a job card — blends into the card's accent tint instead of a stark white pill. */
function stageOutlineStyle(project: string): { background: string; borderColor: string; color: string } {
  const accent = stageAccentColor(project);
  return {
    background: hexToRgba(accent, 0.08),
    borderColor: hexToRgba(accent, 0.3),
    color: accent,
  };
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
                {isCompletedStatus(j.status, j.stage) ? <CompletedStatusBadge label="Matched" /> : <Badge accent={statusBadgeAccent(j.status)}>{statusDisplay(j.status)}</Badge>}
              </div>
            </div>

            {/* Ref + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="list-ref">{j.ref || j.id}</span>
              <PriorityChip priority={j.priority} />
              {j.specificType && (
                <Badge accent={orderBadgeAccent(j.order)}>{j.specificType}</Badge>
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
