import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Building2,
  Check,
  Clock,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  Pencil,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { IClient } from '@contracts';
import { Pagination } from '@modules/shared-ui';
import {
  useApprovedClients,
  useCheckClientId,
  usePendingClients,
  useRejectedClients,
  useSendCcForm,
} from '../hooks/use-admin-clients';
import { ApproveClientModal } from './ApproveClientModal';
import { RejectClientModal } from './RejectClientModal';

type SubTab = 'pending' | 'approved' | 'rejected';
const PER_PAGE = 15;

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
  const [editableClientId, setEditableClientId] = useState('');
  const [isEditingId, setIsEditingId] = useState(false);

  const sendCcForm = useSendCcForm();

  function handleRequestMoreInfo() {
    if (!client) return;
    toast.success(`Request for more information sent to ${client.email}`);
  }

  const { data: checkData, isLoading: isCheckingId } = useCheckClientId(editableClientId, client?.id);
  const isValidFormat = /^\d{5}$/.test(editableClientId);
  const isIdAvailable = checkData?.available ?? true;
  const hasIdError = editableClientId.length === 5 && !isIdAvailable;

  useEffect(() => {
    if (!client) return undefined;
    setEditableClientId(client.client_id || '');
    setIsEditingId(false);

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
  }, [client, onClose]);

  if (!client) return null;

  const displayId = client.client_id || '—';
  const clientName = client.contact_name || client.client_name || '—';

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`Client Registration: ${clientName}`}
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── MODAL HEADER ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Client Registration Details</h2>
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
                  <span className="block text-[11px] font-semibold text-slate-500 mb-0.5">Generated ID</span>
                  {subTab === 'pending' && isEditingId ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="relative">
                          <input
                            type="text"
                            className={`w-28 px-2.5 py-0.5 text-lg font-black bg-white border rounded-[6px] focus:outline-none focus:ring-2 tracking-tight shadow-2xs font-mono ${
                              !isValidFormat || hasIdError
                                ? 'border-rose-400 text-rose-600 focus:ring-rose-500/20 focus:border-rose-500'
                                : 'border-slate-300 text-[#e11d48] focus:ring-rose-500/20 focus:border-rose-500'
                            }`}
                            value={editableClientId}
                            onChange={(e) => setEditableClientId(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            maxLength={5}
                            autoFocus
                            placeholder="5 digits"
                            title="Edit 5-digit Client ID"
                          />
                          {isCheckingId && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="p-1.5 rounded-[6px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition cursor-pointer disabled:opacity-50"
                          onClick={() => {
                            if (isValidFormat && isIdAvailable) setIsEditingId(false);
                          }}
                          disabled={!isValidFormat || !isIdAvailable || isCheckingId}
                          title="Confirm Client ID"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>

                      {editableClientId.length > 0 && !isValidFormat && (
                        <p className="text-[10.5px] text-rose-500 font-medium">
                          Must be exactly 5 digits.
                        </p>
                      )}
                      {hasIdError && !isCheckingId && (
                        <p className="text-[10.5px] text-rose-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Client ID {editableClientId} already exists!</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-[#e11d48] tracking-tight">
                        {editableClientId || displayId}
                      </span>
                      {subTab === 'pending' && (
                        <button
                          type="button"
                          className="p-1 rounded-[6px] text-slate-400 hover:text-[#e11d48] hover:bg-rose-50 transition cursor-pointer"
                          onClick={() => setIsEditingId(true)}
                          title="Edit Client ID"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden sm:block w-[1px] h-10 bg-slate-200" />

                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
                  {subTab === 'pending' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                      Pending Approval
                    </span>
                  ) : subTab === 'approved' ? (
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
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Signed Up</span>
                  <span className="text-xs font-bold text-slate-900">{formatDate(client.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CLIENT DETAILS SECTION */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <UserCheck className="w-4 h-4 text-rose-500" />
              <span>Client Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-[6px] border border-slate-200/90 text-xs">
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Name</span>
                <span className="font-bold text-slate-900 text-sm">{client.contact_name}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Email</span>
                <span className="font-bold text-slate-900 text-sm">{client.email}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Phone</span>
                <span className="font-bold text-slate-900 font-mono">{client.contact_number || '—'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Company</span>
                <span className="font-bold text-slate-900">{client.company_name || '—'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Location</span>
                <span className="font-bold text-slate-900">{client.location || '—'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Country</span>
                <span className="font-bold text-slate-900">{client.country || '—'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Currency</span>
                <span className="font-bold text-slate-900">{client.currency || 'USD'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Registered On</span>
                <span className="font-bold text-slate-900">{formatDate(client.created_at)}</span>
              </div>
            </div>
          </div>

          {/* 3. REJECTION REASON (if rejected) */}
          {subTab === 'rejected' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Clock className="w-4 h-4 text-rose-500" />
                <span>Rejection Reason</span>
              </h3>
              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-[6px] text-rose-700 text-xs italic">
                {client.rejection_note ? `"${client.rejection_note}"` : 'No rejection reason was recorded.'}
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="border-t border-slate-100 bg-slate-50/50 shrink-0">
          {subTab === 'pending' && (
            <div className="px-6 pt-3.5">
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-[6px] bg-blue-50 border border-blue-200/80 text-[11.5px] text-blue-700">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="font-bold">Please verify all details before approval.</strong>{' '}
                  Once approved, the client will receive login credentials to access the portal.
                </span>
              </div>
            </div>
          )}

          <div className="px-6 py-3.5 flex items-center justify-between">
            <button
              type="button"
              className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
              onClick={onClose}
            >
              Close
            </button>

            {subTab === 'pending' && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  onClick={() => sendCcForm.mutate(client.id)}
                  disabled={sendCcForm.isPending}
                >
                  <Mail className="w-4 h-4" />
                  <span>Send CC Form</span>
                </button>
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  onClick={handleRequestMoreInfo}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Request More Information</span>
                </button>
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-[6px] border border-rose-300 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  onClick={() => { onClose(); onReject(client); }}
                >
                  <X className="w-4 h-4 text-rose-600" />
                  <span>Reject Request</span>
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-[6px] bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  onClick={() => {
                    if (!isValidFormat || !isIdAvailable) return;
                    onClose();
                    onApprove({
                      ...client,
                      client_id: editableClientId || client.client_id,
                    });
                  }}
                  disabled={!isValidFormat || !isIdAvailable}
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Activate</span>
                </button>
              </div>
            )}
          </div>
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
      <div className="flex items-center justify-center py-12 text-[var(--color-crimson)] text-sm">
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
              <td className="whitespace-nowrap">
                <span className="ref-code">{c.client_id}</span>
              </td>
              <td>
                <div className="font-semibold whitespace-nowrap truncate max-w-[130px]" title={c.contact_name}>
                  {c.contact_name}
                </div>
              </td>
              <td>
                <div className="text-text-muted whitespace-nowrap truncate max-w-[120px]" title={c.company_name || ''}>
                  {c.company_name || '—'}
                </div>
              </td>
              <td>
                <div className="text-[12px] whitespace-nowrap truncate max-w-[150px]" title={c.email}>
                  {c.email}
                </div>
              </td>
              <td>
                <div className="font-mono text-[11px] text-text-muted whitespace-nowrap truncate max-w-[110px]" title={c.contact_number}>
                  {c.contact_number || '—'}
                </div>
              </td>
              <td>
                <div className="text-text-muted whitespace-nowrap truncate max-w-[120px]" title={c.location || ''}>
                  {c.location || '—'}
                </div>
              </td>
              <td>
                <div className="text-text-muted whitespace-nowrap truncate max-w-[100px]" title={c.country || ''}>
                  {c.country || '—'}
                </div>
              </td>
              <td>
                <div className="text-text-muted font-mono whitespace-nowrap truncate max-w-[60px]">
                  {c.currency || '—'}
                </div>
              </td>
              <td className="text-text-muted text-[12px] whitespace-nowrap">
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              {showRejectionNote && (
                <td>
                  <div className="text-text-muted text-[12px] italic whitespace-nowrap truncate max-w-[160px]" title={c.rejection_note || ''}>
                    {c.rejection_note || '—'}
                  </div>
                </td>
              )}
              {showActions && (
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-[6px] border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                      onClick={() => onReject?.(c)}
                      title="Reject Client"
                      aria-label="Reject Client"
                    >
                      <X className="w-4 h-4 text-rose-600" />
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                      onClick={() => onApprove?.(c)}
                      title="Approve Client"
                      aria-label="Approve Client"
                    >
                      <Check className="w-4 h-4" />
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [approvingClient, setApprovingClient] = useState<IClient | null>(null);
  const [rejectingClient, setRejectingClient] = useState<IClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<IClient | null>(null);
  const autoOpened = useRef(false);

  const pending = usePendingClients();
  const approved = useApprovedClients();
  const rejected = useRejectedClients();

  // Reset page when subtab changes
  useEffect(() => {
    setPage(1);
  }, [activeSubTab]);

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

  const activeClients = useMemo(() => {
    if (activeSubTab === 'pending') return pending.data ?? [];
    if (activeSubTab === 'approved') return approved.data ?? [];
    return rejected.data ?? [];
  }, [activeSubTab, pending.data, approved.data, rejected.data]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return activeClients;
    const q = search.toLowerCase().trim();
    return activeClients.filter((c) =>
      (c.client_id && c.client_id.toLowerCase().includes(q)) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
      (c.client_name && c.client_name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.contact_number && c.contact_number.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q))
    );
  }, [activeClients, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PER_PAGE));

  const pageRows = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredClients.slice(start, start + PER_PAGE);
  }, [filteredClients, page]);

  const subTabs: { key: SubTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: pending.data?.length },
    { key: 'approved', label: 'Approved', count: approved.data?.length },
    { key: 'rejected', label: 'Rejected', count: rejected.data?.length },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[var(--glass-border)] pb-2">
        <div className="flex items-center gap-1">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSubTab(tab.key)}
              className={[
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[9px] cursor-pointer',
                activeSubTab === tab.key
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

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition shadow-2xs"
            placeholder="Search by ID, name, email, company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'pending' && (
        <ClientTable
          clients={pageRows}
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
          clients={pageRows}
          isLoading={approved.isLoading}
          isError={approved.isError}
          emptyMessage="No approved self-registered clients yet."
          onRowClick={(c) => setSelectedClient(c)}
        />
      )}

      {activeSubTab === 'rejected' && (
        <ClientTable
          clients={pageRows}
          isLoading={rejected.isLoading}
          isError={rejected.isError}
          emptyMessage="No rejected client registrations."
          showRejectionNote
          onRowClick={(c) => setSelectedClient(c)}
        />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={activeClients.length}
        perPage={PER_PAGE}
        onPageChange={setPage}
      />

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
