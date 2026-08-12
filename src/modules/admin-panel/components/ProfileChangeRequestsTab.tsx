import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Building2, Check, Clock, Search, UserCheck, X } from 'lucide-react';
import { Pagination } from '@modules/shared-ui';
import {
  useApproveProfileChangeRequest,
  useProfileChangeRequests,
  useRejectProfileChangeRequest,
} from '../hooks/use-profile-change-requests';
import type {
  ChangeRequestStatus,
  ProfileChangeRequest,
} from '../services/admin.service';

const PER_PAGE = 15;

const FIELD_LABEL: Record<string, string> = {
  client_name: 'Full Name',
  company_name: 'Company',
  contact_name: 'Contact Person',
  contact_number: 'Phone',
  date: 'Client Since',
  location: 'Location',
  address: 'Address',
  avatar_url: 'Profile Photo',
};

function renderValue(val: unknown): string {
  if (val === null || val === '') return '(cleared)';
  return String(val);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  search: string;
}

type ReviewAction = 'APPROVE' | 'REJECT';

interface ReviewState {
  request: ProfileChangeRequest;
  action: ReviewAction;
}

export function ProfileChangeRequestsTab({ search: propSearch }: Props) {
  const [status, setStatus] = useState<ChangeRequestStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState('');
  const [reviewing, setReviewing] = useState<ReviewState | null>(null);
  const [selected, setSelected] = useState<ProfileChangeRequest | null>(null);

  const activeSearch = (propSearch || internalSearch).trim().toLowerCase();

  const pendingRes = useProfileChangeRequests({ status: 'PENDING', per_page: 100 });
  const approvedRes = useProfileChangeRequests({ status: 'APPROVED', per_page: 100 });
  const rejectedRes = useProfileChangeRequests({ status: 'REJECTED', per_page: 100 });

  const activeRes = status === 'PENDING' ? pendingRes : status === 'APPROVED' ? approvedRes : rejectedRes;
  const { data, isLoading, isError } = activeRes;

  const approve = useApproveProfileChangeRequest();
  const reject = useRejectProfileChangeRequest();

  const subTabs: { id: ChangeRequestStatus; label: string; count?: number }[] = [
    { id: 'PENDING', label: 'Pending', count: pendingRes.data?.items?.length ?? pendingRes.data?.meta?.total },
    { id: 'APPROVED', label: 'Approved', count: approvedRes.data?.items?.length ?? approvedRes.data?.meta?.total },
    { id: 'REJECTED', label: 'Rejected', count: rejectedRes.data?.items?.length ?? rejectedRes.data?.meta?.total },
  ];

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!activeSearch) return items;
    return items.filter((r) => {
      const c = r.client;
      if (!c) return false;
      const hay = `${c.client_name} ${c.company_name ?? ''} ${c.client_id}`.toLowerCase();
      if (hay.includes(activeSearch)) return true;
      return Object.values(r.changes).some((v) =>
        String(v ?? '').toLowerCase().includes(activeSearch),
      );
    });
  }, [data, activeSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function openReview(row: ProfileChangeRequest, action: ReviewAction) {
    setReviewing({ request: row, action });
  }

  function submitReview(note: string) {
    if (!reviewing) return;
    const payload = { id: reviewing.request.id, note: note.trim() || undefined };
    const mutation = reviewing.action === 'APPROVE' ? approve : reject;
    mutation.mutate(payload, {
      onSuccess: () => setReviewing(null),
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[var(--glass-border)] pb-2">
        <div className="flex items-center gap-1">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
              className={[
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[9px] cursor-pointer',
                status === tab.id
                  ? 'border-[var(--color-crimson)] text-[var(--color-crimson)] font-bold'
                  : 'border-transparent text-text-muted hover:text-text-base',
              ].join(' ')}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 py-0.5"
                  style={{
                    background:
                      tab.id === 'PENDING'
                        ? 'rgba(251,191,36,0.15)'
                        : tab.id === 'APPROVED'
                          ? 'rgba(74,222,128,0.15)'
                          : 'rgba(248,113,113,0.15)',
                    color:
                      tab.id === 'PENDING'
                        ? '#fbbf24'
                        : tab.id === 'APPROVED'
                          ? '#4ade80'
                          : '#f87171',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-2xs"
            placeholder="Search requests by ID, name..."
            value={internalSearch}
            onChange={(e) => {
              setInternalSearch(e.target.value);
              setPage(1);
            }}
          />
          {internalSearch && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              onClick={() => {
                setInternalSearch('');
                setPage(1);
              }}
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-faint text-sm">
          Loading requests…
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-12 text-[var(--color-crimson)] text-sm">
          Failed to load profile change requests. Please refresh and try again.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-text-faint text-sm">
          {activeSearch
            ? 'No requests match your search.'
            : status === 'PENDING'
              ? 'No pending profile requests.'
              : `No ${status.toLowerCase()} requests.`}
        </div>
      ) : (
        <>
          {status === 'PENDING' ? (
            <div
              className="flex items-start gap-2 mb-2 px-3 py-2 rounded-md text-[12px]"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
                color: 'var(--text-main)',
              }}
            >
              <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              <div>
                The client will receive an in-app notification (and a live toast if
                they&apos;re online) with your decision and your note.
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Name</th>
                  <th>Submitted</th>
                  {status === 'PENDING' ? <th className="text-right">Actions</th> : <th>Reviewed</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const c = r.client;
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}>
                      <td className="whitespace-nowrap">
                        {c?.client_id ? (
                          <span className="ref-code">{c.client_id}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <div className="font-semibold whitespace-nowrap truncate max-w-[180px]" title={c?.client_name ?? '—'}>
                          {c?.client_name ?? '— (orphaned)'}
                        </div>
                        {c?.company_name ? (
                          <div className="text-text-muted text-[11.5px] whitespace-nowrap truncate max-w-[180px]" title={c.company_name}>
                            {c.company_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-text-muted text-[11.5px] whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      {status === 'PENDING' ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              className="w-8 h-8 rounded-[6px] border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                              onClick={() => openReview(r, 'REJECT')}
                              disabled={reject.isPending || approve.isPending}
                              title="Reject Request"
                              aria-label="Reject Request"
                            >
                              <X className="w-4 h-4 text-rose-600" />
                            </button>
                            <button
                              type="button"
                              className="w-8 h-8 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white flex items-center justify-center transition cursor-pointer shadow-2xs disabled:opacity-50"
                              onClick={() => openReview(r, 'APPROVE')}
                              disabled={reject.isPending || approve.isPending}
                              title="Approve Request"
                              aria-label="Approve Request"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="text-text-muted text-[11.5px]">
                          {r.reviewed_at ? formatDate(r.reviewed_at) : '—'}
                          {r.review_note ? (
                            <div className="text-text-faint italic mt-0.5">
                              &ldquo;{r.review_note}&rdquo;
                            </div>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Request details modal */}
      <RequestDetailsModal
        request={selected}
        onClose={() => setSelected(null)}
        onApprove={(r) => {
          setSelected(null);
          openReview(r, 'APPROVE');
        }}
        onReject={(r) => {
          setSelected(null);
          openReview(r, 'REJECT');
        }}
        busy={approve.isPending || reject.isPending}
      />

      {/* Approve / Reject review modal — note is shown verbatim to the client */}
      <ReviewModal
        reviewing={reviewing}
        onClose={() => setReviewing(null)}
        onSubmit={submitReview}
        busy={approve.isPending || reject.isPending}
      />
    </div>
  );
}

interface DetailsModalProps {
  request: ProfileChangeRequest | null;
  onClose: () => void;
  onApprove: (r: ProfileChangeRequest) => void;
  onReject: (r: ProfileChangeRequest) => void;
  busy: boolean;
}

function RequestDetailsModal({ request, onClose, onApprove, onReject, busy }: DetailsModalProps) {
  useEffect(() => {
    if (!request) return undefined;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const mainEl = document.getElementById('main-content');
    const originalMainOverflow = mainEl ? mainEl.style.overflow : '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) mainEl.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (mainEl) mainEl.style.overflow = originalMainOverflow;
      window.removeEventListener('keydown', handler);
    };
  }, [request, onClose]);

  if (!request) return null;

  const c = request.client;
  const changeEntries = Object.entries(request.changes);
  const displayId = c?.client_id || '—';
  const clientName = c?.client_name || c?.company_name || '—';

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`Profile Change Request: ${clientName}`}
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── MODAL HEADER ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Profile Change Request</h2>
          <button
            type="button"
            className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. TOP SUMMARY SECTION */}
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-[6px] bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
              <Building2 className="w-7 h-7" />
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-0.5">Client ID</span>
                  <span className="text-2xl font-black text-[#e11d48] tracking-tight">{displayId}</span>
                </div>

                <div className="hidden sm:block w-[1px] h-10 bg-slate-200" />

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Request Status</span>
                  {request.status === 'PENDING' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                      Pending
                    </span>
                  ) : request.status === 'APPROVED' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/80">
                      Rejected
                    </span>
                  )}
                </div>

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Client Name</span>
                  <span className="text-xs font-bold text-slate-900">{clientName}</span>
                </div>

                {c?.company_name && (
                  <div>
                    <span className="block text-[11px] font-semibold text-slate-500 mb-1">Company</span>
                    <span className="text-xs font-bold text-slate-900">{c.company_name}</span>
                  </div>
                )}

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Submitted</span>
                  <span className="text-xs font-bold text-slate-900">{formatDate(request.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. PROPOSED CHANGES SECTION */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <UserCheck className="w-4 h-4 text-rose-500" />
              <span>Proposed Changes</span>
            </h3>

            {changeEntries.length === 0 ? (
              <div className="text-slate-400 py-3 text-center">No field changes in this request.</div>
            ) : (
              <div className="rounded-[6px] border border-slate-200/90 bg-slate-50/50 divide-y divide-slate-200/70 overflow-hidden">
                {changeEntries.map(([k, v]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2">
                    <span className="font-semibold text-slate-700 w-36 shrink-0">{FIELD_LABEL[k] ?? k}:</span>
                    <div className="flex-1 font-semibold text-slate-900 bg-white px-3 py-1.5 rounded border border-slate-200 text-xs">
                      {k === 'avatar_url' && v ? (
                        <img
                          src={String(v)}
                          alt="New profile photo"
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                        />
                      ) : (
                        renderValue(v)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. AUDIT TRAIL */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Audit Trail</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-[6px] border border-slate-200/90 text-xs">
              <div>
                <span className="block text-[11px] text-slate-400 font-medium mb-0.5">Submitted Date</span>
                <span className="font-semibold text-slate-800">{formatDate(request.created_at)}</span>
              </div>
              {request.status !== 'PENDING' && (
                <>
                  <div>
                    <span className="block text-[11px] text-slate-400 font-medium mb-0.5">Reviewed Date</span>
                    <span className="font-semibold text-slate-800">
                      {request.reviewed_at ? formatDate(request.reviewed_at) : '—'}
                    </span>
                  </div>
                  {request.review_note && (
                    <div className="sm:col-span-2 mt-1 pt-2 border-t border-slate-100">
                      <span className="block text-[11px] text-slate-400 font-medium mb-0.5">Reviewer Note</span>
                      <span className="italic text-slate-700 bg-slate-50 p-2 rounded block border border-slate-200/60">
                        &ldquo;{request.review_note}&rdquo;
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>

          {request.status === 'PENDING' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-[6px] border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => onReject(request)}
                disabled={busy}
              >
                <X className="w-4 h-4 text-rose-600" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => onApprove(request)}
                disabled={busy}
              >
                <Check className="w-4 h-4" />
                <span>Approve</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Review (approve / reject) modal ──────────────────────────────────────

interface ReviewModalProps {
  reviewing: ReviewState | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
  busy: boolean;
}

function changedFieldLabels(r: ProfileChangeRequest): string[] {
  return Object.keys(r.changes).map((k) => FIELD_LABEL[k] ?? k);
}

function buildPreview(action: ReviewAction, r: ProfileChangeRequest, note: string): string {
  const fields = changedFieldLabels(r).join(', ') || 'your profile';
  const base =
    action === 'APPROVE'
      ? `Profile update approved — Your changes to ${fields} are now live.`
      : `Profile update rejected — Your requested changes to ${fields} were not accepted.`;
  const trimmed = note.trim();
  return trimmed ? `${base} Note: ${trimmed}` : base;
}

function ReviewModal({ reviewing, onClose, onSubmit, busy }: ReviewModalProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote('');
  }, [reviewing?.request.id, reviewing?.action]);

  useEffect(() => {
    if (!reviewing) return undefined;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const mainEl = document.getElementById('main-content');
    const originalMainOverflow = mainEl ? mainEl.style.overflow : '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) mainEl.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (mainEl) mainEl.style.overflow = originalMainOverflow;
      window.removeEventListener('keydown', handler);
    };
  }, [reviewing, onClose, busy]);

  if (!reviewing) return null;

  const { request, action } = reviewing;
  const isApprove = action === 'APPROVE';
  const title = isApprove ? 'Approve Profile Request' : 'Reject Profile Request';
  const placeholder = isApprove
    ? 'e.g. Updated — verified via call.'
    : 'e.g. Name change needs HR confirmation.';
  const confirmLabel = isApprove
    ? busy
      ? 'Approving…'
      : 'Approve & Notify Client'
    : busy
      ? 'Rejecting…'
      : 'Reject & Notify Client';

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {request.client?.client_name ?? '—'} {request.client?.client_id ? `(${request.client.client_id})` : ''}
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
              Note to the client (optional)
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
            <div className="text-slate-400 text-[11px] mt-1">
              Shown to the client in their notification. {note.length}/1000
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Client Notification Preview
            </span>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs italic leading-relaxed">
              {buildPreview(action, request, note)}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              isApprove
                ? 'px-4 py-2 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5'
                : 'px-4 py-2 rounded-[6px] border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5'
            }
            onClick={() => onSubmit(note)}
            disabled={busy}
          >
            {isApprove ? <Check className="w-4 h-4" /> : <X className="w-4 h-4 text-rose-600" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
