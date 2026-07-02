import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { IClient } from '@contracts';
import { useApprovedClients, usePendingClients, useRejectedClients } from '../hooks/use-admin-clients';
import { ApproveClientModal } from './ApproveClientModal';
import { RejectClientModal } from './RejectClientModal';
import { useState } from 'react';

type SubTab = 'pending' | 'approved' | 'rejected';

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Client detail modal ──────────────────────────────────────────────────────

interface DetailModalProps {
  client: IClient | null;
  subTab: SubTab;
  onClose: () => void;
  onApprove: (c: IClient) => void;
  onReject: (c: IClient) => void;
}

function ClientApproveDetailModal({ client, subTab, onClose, onApprove, onReject }: DetailModalProps) {
  useEffect(() => {
    if (!client) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [client, onClose]);

  if (!client) return null;

  const statusBadge: Record<SubTab, string> = {
    pending: 'badge yellow',
    approved: 'badge green',
    rejected: 'badge red',
  };

  const statusLabel: Record<SubTab, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  const modal = (
    <div
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label="Client details"
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-job-id">{client.client_id}</div>
            <div className="modal-title">{client.client_name}</div>
            <div className="modal-tags">
              <span className={statusBadge[subTab]}>{statusLabel[subTab]}</span>
              {client.company_name ? (
                <span className="badge blue">{client.company_name}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        <div className="modal-body">
          <div className="m-sec-title">Client Details</div>
          <div className="f-row">
            <div className="f-key">Name</div>
            <div className="f-val">{client.contact_name}</div>
          </div>
          <div className="f-row">
            <div className="f-key">Email</div>
            <div className="f-val">{client.email}</div>
          </div>
          <div className="f-row">
            <div className="f-key">Phone</div>
            <div className="f-val">{client.contact_number || '—'}</div>
          </div>
          {client.company_name ? (
            <div className="f-row">
              <div className="f-key">Company</div>
              <div className="f-val">{client.company_name}</div>
            </div>
          ) : null}
          {(client.location) ? (
            <div className="f-row">
              <div className="f-key">Location</div>
              <div className="f-val">{client.location}</div>
            </div>
          ) : null}
          {(client.country) ? (
            <div className="f-row">
              <div className="f-key">Country</div>
              <div className="f-val">{client.country}</div>
            </div>
          ) : null}
          {(client.currency) ? (
            <div className="f-row">
              <div className="f-key">Currency</div>
              <div className="f-val">{client.currency}</div>
            </div>
          ) : null}
          <div className="f-row">
            <div className="f-key">Signed up</div>
            <div className="f-val">{formatDate(client.created_at)}</div>
          </div>

          {subTab === 'rejected' ? (
            <>
              <div className="m-sec-title" style={{ marginTop: 14 }}>Rejection</div>
              {client.rejection_note ? (
                <div className="f-row" style={{ alignItems: 'flex-start' }}>
                  <div className="f-key">Reason</div>
                  <div className="f-val italic">&ldquo;{client.rejection_note}&rdquo;</div>
                </div>
              ) : (
                <div className="text-text-faint text-[12px]">No reason was recorded.</div>
              )}
            </>
          ) : null}
        </div>

        <div className="modal-actions">
          {subTab === 'pending' ? (
            <>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-red"
                onClick={() => { onClose(); onReject(client); }}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                Reject
              </button>
              <button
                type="button"
                className="btn btn-crimson"
                onClick={() => { onClose(); onApprove(client); }}
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

// ─── Shared table ─────────────────────────────────────────────────────────────

function ClientTable({
  clients,
  isLoading,
  isError,
  emptyMessage,
  showActions,
  showRejectionNote,
  onRowClick,
  onApprove,
  onReject,
}: {
  clients: IClient[];
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  showActions?: boolean;
  showRejectionNote?: boolean;
  onRowClick?: (c: IClient) => void;
  onApprove?: (c: IClient) => void;
  onReject?: (c: IClient) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-faint text-sm">
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--crimson)] text-sm">
        Failed to load clients. Please refresh and try again.
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-faint text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Generated ID</th>
            <th>Name</th>
            <th>Company</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Location</th>
            <th>Country</th>
            <th>Currency</th>
            <th>Signup Date</th>
            {showRejectionNote && <th>Rejected Reason</th>}
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr
              key={c.id}
              onClick={() => onRowClick?.(c)}
              style={{ cursor: onRowClick ? 'pointer' : undefined }}
            >
              <td>
                <span className="ref-code">{c.client_id}</span>
              </td>
              <td className="font-semibold whitespace-nowrap">{c.contact_name}</td>
              <td className="text-text-muted">{c.company_name || '—'}</td>
              <td className="text-[12px]">{c.email}</td>
              <td className="font-mono text-[11px] text-text-muted">{c.contact_number}</td>
              <td className="text-text-muted">{c.location || '—'}</td>
              <td className="text-text-muted">{c.country || '—'}</td>
              <td className="text-text-muted font-mono">{c.currency || '—'}</td>
              <td className="text-text-muted text-[12px]">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              {showRejectionNote && (
                <td className="text-text-muted text-[12px] italic">
                  {c.rejection_note || '—'}
                </td>
              )}
              {showActions && (
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => onReject?.(c)}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden />
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-crimson"
                      onClick={() => onApprove?.(c)}
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden />
                      Approve
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function ClientApproveTab({ autoOpenUserId }: { autoOpenUserId?: string }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('pending');
  const [approvingClient, setApprovingClient] = useState<IClient | null>(null);
  const [rejectingClient, setRejectingClient] = useState<IClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<IClient | null>(null);
  const autoOpened = useRef(false);

  const pending = usePendingClients();
  const approved = useApprovedClients();
  const rejected = useRejectedClients();

  // Auto-open the client detail modal when navigated from a notification.
  useEffect(() => {
    if (!autoOpenUserId || autoOpened.current || !pending.data) return;
    const match = pending.data.find((c) => c.user_id === autoOpenUserId);
    if (match) {
      autoOpened.current = true;
      setActiveSubTab('pending');
      setSelectedClient(match);
    }
  }, [autoOpenUserId, pending.data]);

  const subTabs: { key: SubTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: pending.data?.length },
    { key: 'approved', label: 'Approved', count: approved.data?.length },
    { key: 'rejected', label: 'Rejected', count: rejected.data?.length },
  ];

  return (
    <>
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--glass-border)]">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeSubTab === tab.key
                ? 'border-[var(--crimson)] text-[var(--crimson)]'
                : 'border-transparent text-text-muted hover:text-text-base',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 py-0.5"
                style={{
                  background:
                    tab.key === 'pending'
                      ? 'rgba(251,191,36,0.15)'
                      : tab.key === 'approved'
                        ? 'rgba(74,222,128,0.15)'
                        : 'rgba(248,113,113,0.15)',
                  color:
                    tab.key === 'pending'
                      ? '#fbbf24'
                      : tab.key === 'approved'
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

      {activeSubTab === 'pending' && (
        <ClientTable
          clients={pending.data ?? []}
          isLoading={pending.isLoading}
          isError={pending.isError}
          emptyMessage="No pending clients awaiting approval."
          showActions
          onRowClick={(c) => setSelectedClient(c)}
          onApprove={setApprovingClient}
          onReject={setRejectingClient}
        />
      )}

      {activeSubTab === 'approved' && (
        <ClientTable
          clients={approved.data ?? []}
          isLoading={approved.isLoading}
          isError={approved.isError}
          emptyMessage="No approved self-registered clients yet."
          onRowClick={(c) => setSelectedClient(c)}
        />
      )}

      {activeSubTab === 'rejected' && (
        <ClientTable
          clients={rejected.data ?? []}
          isLoading={rejected.isLoading}
          isError={rejected.isError}
          emptyMessage="No rejected client registrations."
          showRejectionNote
          onRowClick={(c) => setSelectedClient(c)}
        />
      )}

      <ClientApproveDetailModal
        client={selectedClient}
        subTab={activeSubTab}
        onClose={() => setSelectedClient(null)}
        onApprove={setApprovingClient}
        onReject={setRejectingClient}
      />

      <ApproveClientModal
        client={approvingClient}
        onClose={() => setApprovingClient(null)}
      />
      <RejectClientModal
        client={rejectingClient}
        onClose={() => setRejectingClient(null)}
      />
    </>
  );
}
