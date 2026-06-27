import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { IClient } from '@contracts';
import { useApprovedClients, usePendingClients, useRejectedClients } from '../hooks/use-admin-clients';
import { ApproveClientModal } from './ApproveClientModal';
import { RejectClientModal } from './RejectClientModal';

type SubTab = 'pending' | 'approved' | 'rejected';

function ClientTable({
  clients,
  isLoading,
  isError,
  emptyMessage,
  showActions,
  onApprove,
  onReject,
}: {
  clients: IClient[];
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  showActions?: boolean;
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
            <th>Email / Phone</th>
            <th>Location</th>
            <th>Signup Date</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="ref-code">{c.client_id}</span>
              </td>
              <td className="font-semibold">{c.contact_name}</td>
              <td className="text-text-muted">{c.company_name || '—'}</td>
              <td>
                <div className="text-[12px]">{c.email}</div>
                <div className="font-mono text-[11px] text-text-muted">{c.contact_number}</div>
              </td>
              <td className="text-text-muted">{c.country || c.location || '—'}</td>
              <td className="text-text-muted text-[12px]">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              {showActions && (
                <td>
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

export function ClientApproveTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('pending');
  const [approvingClient, setApprovingClient] = useState<IClient | null>(null);
  const [rejectingClient, setRejectingClient] = useState<IClient | null>(null);

  const pending = usePendingClients();
  const approved = useApprovedClients();
  const rejected = useRejectedClients();

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
        />
      )}

      {activeSubTab === 'rejected' && (
        <ClientTable
          clients={rejected.data ?? []}
          isLoading={rejected.isLoading}
          isError={rejected.isError}
          emptyMessage="No rejected client registrations."
        />
      )}

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
