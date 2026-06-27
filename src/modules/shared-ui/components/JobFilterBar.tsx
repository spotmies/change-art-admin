/**
 * Comprehensive filter bar for job/quote list pages.
 *
 * Renders a horizontal strip of controls: text search, order type, priority,
 * status, client, and date range. All state is lifted — the parent owns the
 * filter values and passes them in via props so each page can layer its own
 * extra client-side logic on top.
 *
 * Panel filters (order type, priority, status, client, dates) are staged in
 * local draft state and only committed to the parent via `onChange` when the
 * user clicks Apply. Search fires immediately (debounced by the parent).
 */
import { useState } from 'react';
import { ChevronDown, Search, X, SlidersHorizontal } from 'lucide-react';
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
  /** Status options to show — pass empty array to hide the status select */
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
    const to = new Date(f.dateTo).getTime() + 86_399_999;
    result = result.filter((j) => new Date(j.created).getTime() <= to);
  }

  return result;
}

type PanelDraft = Pick<JobFilters, 'orderType' | 'priority' | 'status' | 'clientId' | 'dateFrom' | 'dateTo'>;

function draftFromFilters(f: JobFilters): PanelDraft {
  return {
    orderType: f.orderType,
    priority:  f.priority,
    status:    f.status,
    clientId:  f.clientId,
    dateFrom:  f.dateFrom,
    dateTo:    f.dateTo,
  };
}

function draftHasChanges(draft: PanelDraft | null | undefined, committed: JobFilters | null | undefined): boolean {
  if (!draft || !committed) return false;
  return (
    (draft.orderType ?? '') !== (committed.orderType ?? '') ||
    (draft.priority  ?? '') !== (committed.priority  ?? '') ||
    (draft.status    ?? '') !== (committed.status    ?? '') ||
    (draft.clientId  ?? '') !== (committed.clientId  ?? '') ||
    (draft.dateFrom  ?? '') !== (committed.dateFrom  ?? '') ||
    (draft.dateTo    ?? '') !== (committed.dateTo    ?? '')
  );
}

export function JobFilterBar({
  filters,
  onChange,
  statusOptions = JOB_STATUS_OPTIONS,
  clients = [],
  className = '',
}: JobFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<PanelDraft>(() => draftFromFilters(filters));

  function openPanel() {
    setDraft(draftFromFilters(filters));
    setIsOpen(true);
  }

  function closePanel() {
    setIsOpen(false);
  }

  function setField<K extends keyof PanelDraft>(key: K, value: PanelDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onChange({ search: filters.search, ...draft });
    setIsOpen(false);
  }

  function handleClearAll() {
    const empty: PanelDraft = { orderType: '', priority: '', status: '', clientId: '', dateFrom: '', dateTo: '' };
    setDraft(empty);
    onChange({ search: '', ...empty });
    setIsOpen(false);
  }

  const activeFiltersCount = [
    filters.orderType,
    filters.priority,
    filters.status,
    filters.clientId,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  const hasAnyActive = !isFiltersEmpty(filters);
  const hasDraftChanges = draftHasChanges(draft, filters);

  return (
    <>
      {/* Compact toolbar row: search input + filters toggle button */}
      <div className={`job-filter-bar-row ${className}`}>
        {/* Search — fires immediately, debounced by parent */}
        <div className="filter-search-wrap">
          <Search className="filter-search-icon" />
          <input
            type="text"
            className="filter-search"
            placeholder="Search jobs, clients, designs…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Toggle Filters Button */}
        <button
          type="button"
          onClick={() => (isOpen ? closePanel() : openPanel())}
          className={`filter-toggle-btn${isOpen || activeFiltersCount > 0 ? ' active' : ''}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="filter-badge">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      {/* Expanded filters panel */}
      {isOpen && (
        <div className="filter-expanded-panel">
          {/* Order Type */}
          <div className="filter-select-wrap">
            <select
              className={`filter-select${draft.orderType ? ' active' : ''}`}
              value={draft.orderType}
              onChange={(e) => setField('orderType', e.target.value)}
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
              className={`filter-select${draft.priority ? ' active' : ''}`}
              value={draft.priority}
              onChange={(e) => setField('priority', e.target.value)}
            >
              <option value="" disabled hidden>Priority</option>
              <option value="">All</option>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="filter-chevron" aria-hidden />
          </div>

          {/* Status — hidden when statusOptions is empty */}
          {statusOptions.length > 0 && (
            <div className="filter-select-wrap">
              <select
                className={`filter-select${draft.status ? ' active' : ''}`}
                value={draft.status}
                onChange={(e) => setField('status', e.target.value)}
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
                className={`filter-select${draft.clientId ? ' active' : ''}`}
                value={draft.clientId}
                onChange={(e) => setField('clientId', e.target.value)}
              >
                <option value="" disabled hidden>Client</option>
                <option value="">All</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.client_id}>
                    {c.company_name ?? c.client_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="filter-chevron" aria-hidden />
            </div>
          )}

          {/* Date range */}
          <div className="filter-date-row">
            <div className="filter-date-wrap">
              <span className="filter-date-label">From</span>
              <input
                type="date"
                className={`filter-date${draft.dateFrom ? ' active' : ''}`}
                title="From date"
                value={draft.dateFrom}
                onChange={(e) => setField('dateFrom', e.target.value)}
              />
            </div>
            <div className="filter-date-wrap">
              <span className="filter-date-label">To</span>
              <input
                type="date"
                className={`filter-date${draft.dateTo ? ' active' : ''}`}
                title="To date"
                value={draft.dateTo}
                onChange={(e) => setField('dateTo', e.target.value)}
              />
            </div>
          </div>

          {/* Actions row: Clear All + Apply */}
          <div className="filter-actions-row">
            {(hasAnyActive || hasDraftChanges) && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={handleClearAll}
              >
                <X className="w-3 h-3 inline mr-1" />
                Clear all
              </button>
            )}
            <button
              type="button"
              className={`filter-apply-btn${hasDraftChanges ? ' has-changes' : ''}`}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </>
  );
}
