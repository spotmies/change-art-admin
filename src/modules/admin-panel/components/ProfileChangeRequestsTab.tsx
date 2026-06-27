import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X } from 'lucide-react';
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

const STATUS_FILTERS: { id: ChangeRequestStatus; label: string }[] = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

const PER_PAGE = 20;

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

const STATUS_BADGE: Record<ChangeRequestStatus, string> = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'gray',
};

type ReviewAction = 'APPROVE' | 'REJECT';

interface ReviewState {
  request: ProfileChangeRequest;
  action: ReviewAction;
}

export function ProfileChangeRequestsTab({ search }: Props) {
  const [status, setStatus] = useState<ChangeRequestStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<ReviewState | null>(null);
  const [selected, setSelected] = useState<ProfileChangeRequest | null>(null);

  const { data, isLoading, isError } = useProfileChangeRequests({
    status,
    per_page: 100,
  });

  const approve = useApproveProfileChangeRequest();
  const reject = useRejectProfileChangeRequest();

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const c = r.client;
      if (!c) return false;
      const hay = `${c.client_name} ${c.company_name ?? ''} ${c.client_id}`.toLowerCase();
      if (hay.includes(q)) return true;
      // Also match against proposed new values in `changes`.
      return Object.values(r.changes).some((v) =>
        String(v ?? '').toLowerCase().includes(q),
      );
    });
  }, [data, search]);

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
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--glass-border)]">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setStatus(f.id);
              setPage(1);
            }}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              status === f.id
                ? 'border-[var(--crimson)] text-[var(--crimson)]'
                : 'border-transparent text-text-muted hover:text-text-base',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-faint text-sm">
          Loading requests…
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-12 text-[var(--crimson)] text-sm">
          Failed to load profile change requests. Please refresh and try again.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-text-faint text-sm">
          {search
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
                  <th>Client</th>
                  <th>Proposed Changes</th>
                  <th>Submitted</th>
                  {status === 'PENDING' ? <th></th> : <th>Reviewed</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const c = r.client;
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}>
                      <td>
                        <div className="font-semibold">
                          {c?.client_name ?? '— (orphaned)'}
                        </div>
                        {c?.company_name ? (
                          <div className="text-text-muted text-[11.5px]">
                            {c.company_name}
                          </div>
                        ) : null}
                        {c?.client_id ? (
                          <span className="ref-code">{c.client_id}</span>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          {Object.entries(r.changes).map(([k, v]) => (
                            <div key={k} className="text-[12px] whitespace-pre-wrap break-words max-w-[60ch] flex items-center gap-2">
                              <span className="text-text-faint">
                                {FIELD_LABEL[k] ?? k}:
                              </span>{' '}
                              {k === 'avatar_url' && v ? (
                                <img
                                  src={String(v)}
                                  alt="New profile photo"
                                  className="w-8 h-8 rounded-full object-cover border border-glass-border"
                                />
                              ) : (
                                <span className="font-semibold">{renderValue(v)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="text-text-muted text-[11.5px]">
                        {formatDate(r.created_at)}
                      </td>
                      {status === 'PENDING' ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => openReview(r, 'REJECT')}
                              disabled={reject.isPending || approve.isPending}
                            >
                              <X className="w-3.5 h-3.5" aria-hidden />
                              Reject
                            </button>
                            <button
                              type="button"
                              className="btn btn-crimson"
                              onClick={() => openReview(r, 'APPROVE')}
                              disabled={reject.isPending || approve.isPending}
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden />
                              Approve
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [request, onClose]);

  if (!request) return null;

  const c = request.client;
  const changeEntries = Object.entries(request.changes);

  const modal = (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal
      aria-label="Profile change request"
    >
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            {c?.client_id ? <div className="modal-job-id">{c.client_id}</div> : null}
            <div className="modal-title">{c?.client_name ?? '— (orphaned)'}</div>
            <div className="modal-tags">
              <span className={`badge ${STATUS_BADGE[request.status]}`}>{request.status}</span>
              {c?.company_name ? <span className="badge blue">{c.company_name}</span> : null}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        <div className="modal-body">
          <div className="m-sec-title">Proposed Changes</div>
          {changeEntries.length === 0 ? (
            <div className="text-text-faint text-[12px]">No fields in this request.</div>
          ) : (
            changeEntries.map(([k, v]) => (
              <div key={k} className="f-row">
                <div className="f-key">{FIELD_LABEL[k] ?? k}</div>
                <div className="f-val" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '60ch' }}>
                  {k === 'avatar_url' && v ? (
                    <img
                      src={String(v)}
                      alt="New profile photo"
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : renderValue(v)}
                </div>
              </div>
            ))
          )}

          <div className="m-sec-title" style={{ marginTop: 14 }}>Audit</div>
          <div className="f-row">
            <div className="f-key">Submitted</div>
            <div className="f-val">{formatDate(request.created_at)}</div>
          </div>
          {request.status !== 'PENDING' ? (
            <>
              <div className="f-row">
                <div className="f-key">Reviewed</div>
                <div className="f-val">
                  {request.reviewed_at ? formatDate(request.reviewed_at) : '—'}
                </div>
              </div>
              {request.review_note ? (
                <div className="f-row">
                  <div className="f-key">Note</div>
                  <div className="f-val italic">&ldquo;{request.review_note}&rdquo;</div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="modal-actions">
          {request.status === 'PENDING' ? (
            <>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-red"
                onClick={() => onReject(request)}
                disabled={busy}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                Reject
              </button>
              <button
                type="button"
                className="btn btn-crimson"
                onClick={() => onApprove(request)}
                disabled={busy}
              >
                <Check className="w-3.5 h-3.5" aria-hidden />
                Approve
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Review (approve / reject) modal ──────────────────────────────────────
// The note is shown verbatim to the client in their notification, so we label
// the field as customer-facing and render a live preview of the message.

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reviewing, onClose, busy]);

  if (!reviewing) return null;

  const { request, action } = reviewing;
  const isApprove = action === 'APPROVE';
  const title = isApprove ? 'Approve this profile request?' : 'Reject this profile request?';
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
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title">{title}</div>
            <div className="text-text-faint text-[11.5px] mt-0.5">
              {request.client?.client_name ?? '— (orphaned)'}
              {request.client?.client_id ? ` · ${request.client.client_id}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        <div className="modal-body">
          <label className="fl">Note to the client (optional)</label>
          <textarea
            className="fi"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="text-text-faint text-[11px] mt-1">
            Shown to the client in their notification. {note.length}/1000
          </div>

          <div className="m-sec-title" style={{ marginTop: 14 }}>
            The client will see
          </div>
          <div
            className="px-3 py-2 rounded-md text-[12px] italic"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
            }}
          >
            {buildPreview(action, request, note)}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={isApprove ? 'btn btn-crimson' : 'btn btn-red'}
            onClick={() => onSubmit(note)}
            disabled={busy}
          >
            {isApprove ? (
              <Check className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <X className="w-3.5 h-3.5" aria-hidden />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
