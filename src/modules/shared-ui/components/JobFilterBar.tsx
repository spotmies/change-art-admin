/**
 * Comprehensive filter bar for job/quote list pages.
 *
 * Renders a horizontal strip of controls: text search, order type, priority,
 * status, client, and date range. All state is lifted — the parent owns the
 * filter values and passes them in via props so each page can layer its own
 * extra client-side logic on top.
 */
import { ChevronDown, Search, X } from 'lucide-react';
import type { IClient } from '@contracts';

export interface JobFilters {
  search: string;
  orderType: string;
  priority: string;
  status: string;
  clientId: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: JobFilters = {
  search: '',
  orderType: '',
  priority: '',
  status: '',
  clientId: '',
  dateFrom: '',
  dateTo: '',
};

interface JobFilterBarProps {
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
  /** Status options to show — varies by page (e.g. jobs vs quotes) */
  statusOptions?: { value: string; label: string }[];
  clients?: IClient[];
  className?: string;
}

const ORDER_OPTIONS = [
  { value: 'Artwork',             label: 'Artwork' },
  { value: 'Digitizing',          label: 'Digitizing' },
  { value: 'Digitizing + Sewout', label: 'Digitizing + Sewout' },
  { value: 'Others',              label: 'Others' },
];

const PRIORITY_OPTIONS = [
  { value: 'Normal',     label: 'Normal' },
  { value: 'Rush',       label: '🔴 Rush' },
  { value: 'Super Rush', label: '🚨 Super Rush' },
];

export const JOB_STATUS_OPTIONS = [
  { value: 'Order Placed',      label: 'Order Placed' },
  { value: 'In Production',     label: 'In Production' },
  { value: 'Senior Review',     label: 'Senior Review' },
  { value: 'Sewout',            label: 'Sewout' },
  { value: 'In QC',             label: 'In QC' },
  { value: 'Ready to Deliver',  label: 'Ready to Deliver' },
  { value: 'Delivered',         label: 'Delivered' },
  { value: 'Amend',             label: 'Amend' },
  { value: 'Cancelled',         label: 'Cancelled' },
];

export const QUOTE_STATUS_OPTIONS = [
  { value: 'Quote Submitted', label: 'Quote Submitted' },
  { value: 'Quote Approved',  label: 'Quote Approved' },
];

function set<K extends keyof JobFilters>(
  filters: JobFilters,
  key: K,
  value: JobFilters[K],
  onChange: (f: JobFilters) => void,
) {
  onChange({ ...filters, [key]: value });
}

export function isFiltersEmpty(f: JobFilters): boolean {
  return (
    !f.search &&
    !f.orderType &&
    !f.priority &&
    !f.status &&
    !f.clientId &&
    !f.dateFrom &&
    !f.dateTo
  );
}

/**
 * Apply the filter bar's values to a Job array.
 * `Job` is imported from shared-ui mocks shape (design, order, priority, status, client, clientId, created, ref, id).
 */
export function applyJobFilters<
  T extends {
    design: string;
    order: string;
    priority: string;
    status: string;
    client: string;
    clientId?: string;
    ref: string;
    id: string;
    created: string;
    summary?: string;
    specificType?: string | null;
  },
>(jobs: T[], f: JobFilters): T[] {
  let result = jobs;

  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter(
      (j) =>
        j.design.toLowerCase().includes(q) ||
        j.client.toLowerCase().includes(q) ||
        j.ref.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        (j.summary ?? '').toLowerCase().includes(q) ||
        (j.specificType ?? '').toLowerCase().includes(q),
    );
  }

  if (f.orderType) {
    result = result.filter((j) => j.order === f.orderType);
  }

  if (f.priority) {
    result = result.filter((j) => j.priority === f.priority);
  }

  if (f.status) {
    result = result.filter((j) => j.status === f.status);
  }

  if (f.clientId) {
    result = result.filter((j) => j.clientId === f.clientId);
  }

  if (f.dateFrom) {
    const from = new Date(f.dateFrom).getTime();
    result = result.filter((j) => new Date(j.created).getTime() >= from);
  }

  if (f.dateTo) {
    // Include the whole "to" day by setting time to end-of-day.
    const to = new Date(f.dateTo).getTime() + 86_399_999;
    result = result.filter((j) => new Date(j.created).getTime() <= to);
  }

  return result;
}

export function JobFilterBar({
  filters,
  onChange,
  statusOptions = JOB_STATUS_OPTIONS,
  clients = [],
  className = '',
}: JobFilterBarProps) {
  const hasActive = !isFiltersEmpty(filters);

  return (
    <div className={`job-filter-bar ${className}`}>
      {/* Search */}
      <div className="filter-search-wrap">
        <Search className="filter-search-icon w-3.5 h-3.5" />
        <input
          type="text"
          className="filter-search"
          placeholder="Search jobs, clients, designs…"
          value={filters.search}
          onChange={(e) => set(filters, 'search', e.target.value, onChange)}
        />
      </div>

      {/* Order Type */}
      <div className="filter-select-wrap">
        <select
          className={`filter-select${filters.orderType ? ' active' : ''}`}
          value={filters.orderType}
          onChange={(e) => set(filters, 'orderType', e.target.value, onChange)}
        >
          <option value="" disabled hidden>Order Type</option>
          <option value="">All</option>
          {ORDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="filter-chevron" aria-hidden />
      </div>

      {/* Priority */}
      <div className="filter-select-wrap">
        <select
          className={`filter-select${filters.priority ? ' active' : ''}`}
          value={filters.priority}
          onChange={(e) => set(filters, 'priority', e.target.value, onChange)}
        >
          <option value="" disabled hidden>Priority</option>
          <option value="">All</option>
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="filter-chevron" aria-hidden />
      </div>

      {/* Status */}
      {statusOptions.length > 0 && (
        <div className="filter-select-wrap">
          <select
            className={`filter-select${filters.status ? ' active' : ''}`}
            value={filters.status}
            onChange={(e) => set(filters, 'status', e.target.value, onChange)}
          >
            <option value="" disabled hidden>Status</option>
            <option value="">All</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="filter-chevron" aria-hidden />
        </div>
      )}

      {/* Client */}
      {clients.length > 0 && (
        <div className="filter-select-wrap">
          <select
            className={`filter-select${filters.clientId ? ' active' : ''}`}
            value={filters.clientId}
            onChange={(e) => set(filters, 'clientId', e.target.value, onChange)}
          >
            <option value="" disabled hidden>Client</option>
            <option value="">All</option>
            {clients.map((c) => (
              // Use human-readable client_id (e.g. "CLI0002") — matches Job.clientId
              <option key={c.id} value={c.client_id}>
                {c.company_name ?? c.client_name}
              </option>
            ))}
          </select>
          <ChevronDown className="filter-chevron" aria-hidden />
        </div>
      )}

      {/* Date From */}
      <div className="filter-date-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</span>
        <input
          type="date"
          className={`filter-date${filters.dateFrom ? ' active' : ''}`}
          title="From date"
          value={filters.dateFrom}
          onChange={(e) => set(filters, 'dateFrom', e.target.value, onChange)}
        />
      </div>

      {/* Date To */}
      <div className="filter-date-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
        <input
          type="date"
          className={`filter-date${filters.dateTo ? ' active' : ''}`}
          title="To date"
          value={filters.dateTo}
          onChange={(e) => set(filters, 'dateTo', e.target.value, onChange)}
        />
      </div>

      {/* Clear */}
      {hasActive && (
        <button
          type="button"
          className="filter-clear-btn"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="w-3 h-3 inline mr-1" />
          Clear
        </button>
      )}
    </div>
  );
}
