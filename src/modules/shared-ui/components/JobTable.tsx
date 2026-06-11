import { useMemo, useState, useCallback, type ReactNode } from 'react';
import { JobDetailModal } from './JobDetailModal';
import { EditJobModal } from './EditJobModal';
import { AssignJobModal } from './AssignJobModal';
import { Inbox, Clock, CheckCircle2, Download, Search } from 'lucide-react';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
import { cn } from '@lib/utils';
import { jobImage, type Job } from '../mocks/jobs';

function statusDisplay(status: string): string {
  if (status === 'Pending Client Confirm' || status === 'Quote Approved') return 'Action Required';
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
  /** Open the quote popup (Review & Set Price) from this table's View button. */
  quoteView?: boolean;
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
  showActions = false,
  onOpen,
  renderActions,
  emptyLabel = 'No jobs found',
  controlsExtra,
  quoteView = false,
}: JobTableProps) {
  const [view, setView] = useState<JobView>(defaultView);
  const [query, setQuery] = useState('');
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [assignJob, setAssignJob] = useState<Job | null>(null);

  const handleOpen = useCallback((job: Job) => {
    if (onOpen) { onOpen(job); } else { setViewJob(job); }
  }, [onOpen]);

  const builtInActions = useCallback((j: Job) => (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setViewJob(j)}
        aria-label={`View ${j.id}`}
      >
        View
      </button>
      <button
        type="button"
        className="btn btn-crimson"
        onClick={() => setEditJob(j)}
        aria-label={`Edit ${j.id}`}
      >
        Edit
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

  if (!jobs.length) {
    return (
      <div className={variant === 'delivered' ? 'w-full' : 'jobs-root'} data-view={view}>
        <EmptyState label={emptyLabel} />
      </div>
    );
  }

  const renderRowActions = renderActions ?? (showActions ? builtInActions : undefined);

  return (
    <div className={variant === 'delivered' ? 'w-full' : 'jobs-root'} data-view={view}>
      {withControls ? (
        <div className="tbl-top">
          <div className="tbl-search-wrap">
            <Search className="tbl-search-icon" aria-hidden />
            <input
              type="text"
              className="tbl-search"
              placeholder="Search jobs, clients, designs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search jobs"
            />
          </div>
          <div className="view-toggle" role="tablist" aria-label="Job views">
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
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState label={emptyLabel} />
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
      <JobDetailModal
        job={viewJob}
        onClose={() => setViewJob(null)}
        onEdit={(j) => { setViewJob(null); setEditJob(j); }}
        onAssign={(j) => { setViewJob(null); setAssignJob(j); }}
        quoteView={quoteView}
      />
      <EditJobModal
        job={editJob}
        onClose={() => setEditJob(null)}
        onBack={(j) => { setEditJob(null); setViewJob(j); }}
      />
      <AssignJobModal
        job={assignJob}
        onClose={() => setAssignJob(null)}
      />
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
              <div className="flex items-center gap-2 mb-2">
                <span className="jc-id">{job.id}</span>
                <Badge accent={statusBadgeAccent(job.status)}>{statusDisplay(job.status)}</Badge>
                <PriorityChip priority={job.priority} />
              </div>
              <div className="text-[15px] font-bold text-text-main">{job.design}</div>
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
              {job.summary}
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
    'Senior Review': 'purple',
    Sewout: 'purple',
    'Ready to Deliver': 'teal',
    Delivered: 'green',
    'Quote Submitted': 'blue',
    'Quote Approved': 'amber',
    'Pending Client Confirm': 'amber',
    Cancelled: 'gray',
    Amend: 'amber',
    'In Review': 'purple',
  };
  return map[status] || 'gray';
}

function orderBadgeAccent(order: string): string {
  const map: Record<string, string> = {
    Artwork: 'navy',
    Digitizing: 'teal',
    'Digitizing + Sewout': 'purple',
    Sewout: 'purple',
  };
  return map[order] || 'gray';
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
                  className="font-bold text-[14px] text-text-main leading-snug block max-w-[260px]"
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
                />
              </td>
              <td><Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge></td>
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
}: {
  jobs: Job[];
  onOpen?: (job: Job) => void;
  renderRowActions?: (job: Job) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid-view grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 py-2", className)}>
      {jobs.map((j) => {
        const actionRequired = j.status === 'Pending Client Confirm' || j.status === 'Quote Approved';
        const agencyPrice = j.negotiation?.agencyOffer ?? j.adminPrice ?? null;
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
            <div className="jc-img">
              <img
                className="w-full h-[90px] md:h-[110px] object-cover block"
                src={jobImage(j, 0, 400, 300)}
                alt={j.design}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <span className={cn('jc-status-overlay badge', statusBadgeAccent(j.status))}>
                {statusDisplay(j.status)}
              </span>
            </div>
            <div className="jc-body">
              <div className="jc-title">{j.design}</div>
              <div className="jc-desc">{j.summary}</div>
              <div className="jc-meta">
                <span className="truncate max-w-[90px]">{j.client}</span>
                <Badge accent={orderBadgeAccent(j.order)}>{j.order}</Badge>
                <PriorityChip priority={j.priority} />
              </div>
              {actionRequired ? (
                <div className="jc-action">
                  <CheckCircle2 aria-hidden className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>
                    Agency price ready{agencyPrice ? ` — $${agencyPrice}` : ''} ·{' '}
                    <strong>Tap to confirm &amp; start production</strong>
                  </span>
                </div>
              ) : null}
              {renderRowActions ? renderRowActions(j) : null}
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
    <div className={cn("list-view", className)}>
      {jobs.map((j) => (
        <div
          key={j.id}
          className={cn('job-list-item', priorityCardClass(j.priority))}
          onClick={() => onOpen?.(j)}
          role="button"
          tabIndex={0}
        >
          <div className="list-thumb">
            <img
              src={jobImage(j, 0, 120, 120)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="list-body">
            <div className="list-title">{j.design}</div>
            <div className="list-desc">{j.summary}</div>
            <div className="list-meta">
              {j.ref || j.id} · {j.order} · {j.status}
            </div>
            {renderRowActions ? renderRowActions(j) : null}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="list-date">{formatDate(j.created)}</div>
            {j.etaHours ? (
              <div className="list-eta">
                <Clock className="w-3.5 h-3.5 stroke-[2]" />
                <span>{j.etaHours}h</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
