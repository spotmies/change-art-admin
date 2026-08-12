import { useState, useEffect } from 'react';
import { ChevronDown, Search, X, CalendarDays, Filter } from 'lucide-react';
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
  search: '', orderType: '', priority: '', status: '', clientId: '', dateFrom: '', dateTo: '',
};

interface JobFilterBarProps {
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
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
  { value: 'Rush',       label: 'Rush' },
  { value: 'Super Rush', label: 'Super Rush' },
];

export const JOB_STATUS_OPTIONS = [
  { value: 'In Review',        label: 'In Review' },
  { value: 'Quote Submitted',  label: 'Quote Submitted' },
  { value: 'Order Placed',     label: 'Order Placed' },
  { value: 'Pending',          label: 'Pending' },
  { value: 'In Production',    label: 'In Production' },
  { value: 'Senior Review',    label: 'Senior Review' },
  { value: 'Sewout',           label: 'Sewout' },
  { value: 'In QC',            label: 'In QC' },
  { value: 'Ready to Deliver', label: 'Ready to Dispatch' },
  { value: 'On Hold',          label: 'On Hold' },
  { value: 'Dispatched',        label: 'Dispatched' },
  { value: 'Amend',            label: 'Amend' },
  { value: 'Cancelled',        label: 'Cancelled' },
];

export const QUOTE_STATUS_OPTIONS = [
  { value: 'Quote Submitted', label: 'Quote Submitted' },
  { value: 'Quote Approved',  label: 'Quote Sent' },
];

export function isFiltersEmpty(f: JobFilters): boolean {
  return !f.search && !f.orderType && !f.priority && !f.status && !f.clientId && !f.dateFrom && !f.dateTo;
}

export function applyJobFilters<
  T extends {
    design: string; order: string; priority: string; status: string;
    client: string; clientId?: string; ref: string; id: string;
    created: string; summary?: string; specificType?: string | null;
  },
>(jobs: T[], f: JobFilters, clients: IClient[] = []): T[] {
  let result = jobs;
  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter((j) =>
      j.design.toLowerCase().includes(q) || j.client.toLowerCase().includes(q) ||
      j.ref.toLowerCase().includes(q) || j.id.toLowerCase().includes(q) ||
      (j.summary ?? '').toLowerCase().includes(q) || (j.specificType ?? '').toLowerCase().includes(q),
    );
  }
  if (f.orderType) result = result.filter((j) => j.order === f.orderType);
  if (f.priority)  result = result.filter((j) => j.priority === f.priority);
  if (f.status)    result = result.filter((j) => j.status === f.status);
  if (f.clientId) {
    const targetClient = clients.find((c) => c.client_id === f.clientId || c.id === f.clientId);
    result = result.filter((j) => {
      if (j.clientId === f.clientId) return true;
      if (targetClient && (j.clientId === targetClient.client_id || j.clientId === targetClient.id)) return true;
      return false;
    });
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

type Draft = Pick<JobFilters, 'orderType' | 'priority' | 'status' | 'clientId' | 'dateFrom' | 'dateTo'>;

function toDraft(f: JobFilters): Draft {
  return { orderType: f.orderType, priority: f.priority, status: f.status, clientId: f.clientId, dateFrom: f.dateFrom, dateTo: f.dateTo };
}


export function JobFilterBar({ filters, onChange, statusOptions = JOB_STATUS_OPTIONS, clients = [], className = '' }: JobFilterBarProps) {
  const [open, setOpen] = useState(() => !isFiltersEmpty(filters));
  const [draft, setDraft] = useState<Draft>(() => toDraft(filters));

  useEffect(() => {
    setDraft(toDraft(filters));
    if (!isFiltersEmpty(filters)) {
      setOpen(true);
    }
  }, [filters]);

  function closePanel() { setOpen(false); }

  function setField<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((p) => ({ ...p, [k]: v }));
  }

  function handleApply() { onChange({ search: filters.search, ...draft }); closePanel(); }

  function handleClear() {
    const empty: Draft = { orderType: '', priority: '', status: '', clientId: '', dateFrom: '', dateTo: '' };
    setDraft(empty);
    onChange({ search: '', ...empty });
    closePanel();
  }

  const draftDirty =
    draft.orderType !== filters.orderType || draft.priority !== filters.priority ||
    draft.status !== filters.status || draft.clientId !== filters.clientId ||
    draft.dateFrom !== filters.dateFrom || draft.dateTo !== filters.dateTo;

  return (
    <div className={`fjb-root ${className}`}>

      {/* ── Top row: search + Filters button ── */}
      <div className="fjb-top-row flex items-center gap-2">
        <div className="fjb-search-wrap flex-1">
          <Search className="fjb-search-icon" aria-hidden />
          <input
            type="text"
            className="fjb-search"
            placeholder="Search jobs, clients, designs…"
            value={filters.search}
            maxLength={500}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button type="button" className="fjb-search-x" onClick={() => onChange({ ...filters, search: '' })} aria-label="Clear search">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`h-[38px] px-3.5 rounded-[10px] border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs ${
            open || !isFiltersEmpty(filters)
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {!isFiltersEmpty(filters) && (
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
          )}
        </button>
      </div>

      {/* ── Expanded filter panel — single row ── */}
      {open && (
        <div className="fjb-panel" role="region" aria-label="Filters">
          <div className="fjb-single-row">

            {/* Order Type */}
            <div className={`fjb-select-inner${draft.orderType ? ' active' : ''}`}>
              <select className="fjb-select" value={draft.orderType} onChange={(e) => setField('orderType', e.target.value)}>
                <option value="">Order Type</option>
                {ORDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="fjb-chevron" aria-hidden />
              {draft.orderType && <button type="button" className="fjb-select-clear" onClick={() => setField('orderType', '')} aria-label="Clear order type"><X className="w-2.5 h-2.5" /></button>}
            </div>

            {/* Priority */}
            <div className={`fjb-select-inner${draft.priority ? ' active' : ''}`}>
              <select className="fjb-select" value={draft.priority} onChange={(e) => setField('priority', e.target.value)}>
                <option value="">Priority</option>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="fjb-chevron" aria-hidden />
              {draft.priority && <button type="button" className="fjb-select-clear" onClick={() => setField('priority', '')} aria-label="Clear priority"><X className="w-2.5 h-2.5" /></button>}
            </div>

            {/* Status */}
            {statusOptions.length > 0 && (
              <div className={`fjb-select-inner${draft.status ? ' active' : ''}`}>
                <select className="fjb-select" value={draft.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="">Status</option>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="fjb-chevron" aria-hidden />
                {draft.status && <button type="button" className="fjb-select-clear" onClick={() => setField('status', '')} aria-label="Clear status"><X className="w-2.5 h-2.5" /></button>}
              </div>
            )}

            {/* Client */}
            {clients.length > 0 && (
              <div className={`fjb-select-inner${draft.clientId ? ' active' : ''}`}>
                <select className="fjb-select" value={draft.clientId} onChange={(e) => setField('clientId', e.target.value)}>
                  <option value="">Client</option>
                  {clients.map((c) => <option key={c.id} value={c.client_id}>{c.company_name ?? c.client_name}</option>)}
                </select>
                <ChevronDown className="fjb-chevron" aria-hidden />
                {draft.clientId && <button type="button" className="fjb-select-clear" onClick={() => setField('clientId', '')} aria-label="Clear client"><X className="w-2.5 h-2.5" /></button>}
              </div>
            )}

            {/* Date range — kept together so the pair never splits across lines */}
            <div className="fjb-date-group">
              <div className={`fjb-date-wrap${draft.dateFrom ? ' active' : ''}`}>
                <CalendarDays className="fjb-date-icon" aria-hidden />
                <input type="date" className="fjb-date-input" placeholder="From" title="From date" value={draft.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} />
              </div>
              <span className="fjb-date-arrow">→</span>
              <div className={`fjb-date-wrap${draft.dateTo ? ' active' : ''}`}>
                <CalendarDays className="fjb-date-icon" aria-hidden />
                <input type="date" className="fjb-date-input" placeholder="To" title="To date" value={draft.dateTo} onChange={(e) => setField('dateTo', e.target.value)} />
              </div>
            </div>

            {/* Actions — pushed to the right */}
            <div className="fjb-inline-actions">
              {(draftDirty || !isFiltersEmpty(filters)) && (
                <button type="button" className="fjb-clear-btn" onClick={handleClear} aria-label="Clear all filters">
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                className={`fjb-apply-btn${draftDirty ? ' fjb-apply-btn--ready' : ''}`}
                onClick={handleApply}
              >
                Apply
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
