import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Pencil, Plus, Search, ShieldAlert, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import { ConfirmModal, GreetingHero, Pagination, Panel, RowActionsMenu, StatGrid } from '@modules/shared-ui';
import type { IClient } from '@contracts';
import { formatDateTime } from '@lib/utils';
import { useAdminClients, useSendCcForm, useAdminClientById, useSetClientActive, useSetClientHotlisted } from '../../modules/admin-panel/hooks/use-admin-clients';
import { useProfileChangeRequests } from '../../modules/admin-panel/hooks/use-profile-change-requests';
import {
  ClientDetailModal,
  type ClientModalMode,
} from '../../modules/admin-panel/components/ClientDetailModal';
import { ClientSectionGateModal } from '../../modules/admin-panel/components/ClientSectionGateModal';
import { ProfileChangeRequestsTab } from '../../modules/admin-panel/components/ProfileChangeRequestsTab';
import { AddClientModal } from '../../modules/admin-panel/components/AddClientModal';
import { ClientApproveTab } from '../../modules/admin-panel/components/ClientApproveTab';
import { usePendingClients } from '../../modules/admin-panel/hooks/use-admin-clients';

const PER_PAGE = 20;

type Tab = 'clients' | 'requests' | 'approve';



function currentMonthCount(items: { created_at: string }[]): number {
  const now = new Date();
  return items.filter((c) => {
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const SESSION_FLAG = 'clients_otp_verified';

function isSessionVerified(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function markSessionVerified(): void {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    // sessionStorage unavailable — gate will re-appear on next click but won't break anything
  }
}

export function AdminClientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pageGateOpen, setPageGateOpen] = useState(() => !isSessionVerified());

  const initialTab = (searchParams.get('tab') as Tab) || 'clients';
  const [tab, setTab] = useState<Tab>(['requests', 'approve'].includes(initialTab) ? initialTab : 'clients');

  // Sync tab state when URL search params change
  useEffect(() => {
    const t = searchParams.get('tab') as Tab;
    if (['requests', 'clients', 'approve'].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hotlistedOnly, setHotlistedOnly] = useState(false);
  // Track only the id + mode, not the clicked row's snapshot — the snapshot
  // never updates again once stored. Deriving the live client below from
  // `useAdminClientById` means the open modal re-fetches and reflects changes
  // in real time (e.g. the CLIENT_UPDATED socket event firing when the client
  // edits their own profile/payment details), matching the same fix applied
  // to job cards.
  const [selected, setSelected] = useState<{ clientId: string; mode: ClientModalMode } | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<IClient | null>(null);
  const [hotlistTarget, setHotlistTarget] = useState<IClient | null>(null);
  const [sendCcFormTarget, setSendCcFormTarget] = useState<IClient | null>(null);

  const setActive = useSetClientActive();
  const setHotlisted = useSetClientHotlisted();
  const { data: selectedClient } = useAdminClientById(selected?.clientId ?? null);
  const sendCcForm = useSendCcForm();

  function openClient(client: IClient, mode: ClientModalMode) {
    setSelected({ clientId: client.id, mode });
  }

  const debouncedSearch = useDebounced(search, 300);

  // Pending count for the toggle badge — same query key as the sidebar hook,
  // so this is a cache hit.
  const { data: pendingCRs } = useProfileChangeRequests({
    status: 'PENDING',
    per_page: 100,
  });
  const pendingCount = pendingCRs?.meta.total ?? 0;

  const { data: pendingApprovals } = usePendingClients();
  const pendingApprovalsCount = pendingApprovals?.length ?? 0;
  const autoOpenUserId = searchParams.get('open_user') ?? undefined;

  const clientsFilters = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(hotlistedOnly ? { hotlisted: true } : {}),
    }),
    [page, debouncedSearch, hotlistedOnly],
  );

  const { data, isLoading, isError } = useAdminClients(clientsFilters);

  // Reset to page 1 whenever the active search or hotlist filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, hotlistedOnly]);

  // Reset state when switching tabs.
  useEffect(() => {
    setSearch('');
    setPage(1);
  }, [tab]);

  // Strip open_user from the URL after passing it down, so a page refresh
  // doesn't re-open the modal.
  useEffect(() => {
    if (!autoOpenUserId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('open_user');
    navigate({ search: next.toString() }, { replace: true });
  }, [autoOpenUserId, navigate, searchParams]);

  const clients = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.total_pages ?? 1;

  return (
    <div className="page">
      <GreetingHero
        title="Client Management"
        subtitle="Master client directory — onboarding state, lifetime spend, churn risk, and assigned Client Servicing owner."
      />

      <StatGrid
        stats={[
          { accent: 'blue', label: 'Active Accounts', value: isLoading ? '…' : total },
          { accent: 'green', label: 'New (mo.)', value: isLoading ? '…' : currentMonthCount(clients) },
          { accent: 'crimson', label: 'Profile Requests', value: pendingCount },
          {
            accent: 'gold',
            label: 'Top Client',
            value: isLoading ? '…' : (clients[0]?.company_name ?? clients[0]?.client_name ?? '—'),
          },
        ]}
      />

      <Panel
        title={
          tab === 'clients'
            ? `All Clients${total ? ` (${total})` : ''}`
            : tab === 'requests'
              ? 'Profile Change Requests'
              : 'Pending Client Approvals'
        }
      >
        {/* Tab toggle + search bar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-glass-border">
            <button
              type="button"
              className={`btn ${tab === 'clients' ? 'btn-crimson' : 'btn-outline'}`}
              onClick={() => setTab('clients')}
            >
              Clients
            </button>
            <button
              type="button"
              className={`btn ${tab === 'approve' ? 'btn-crimson' : 'btn-outline'}`}
              onClick={() => setTab('approve')}
            >
              Sign Up Requests
              {pendingApprovalsCount > 0 ? (
                <span
                  className="ml-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5"
                  style={{
                    background: 'var(--crimson)',
                    color: 'white',
                    minWidth: 16,
                    height: 16,
                  }}
                >
                  {pendingApprovalsCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`btn ${tab === 'requests' ? 'btn-crimson' : 'btn-outline'}`}
              onClick={() => setTab('requests')}
            >
              Profile Requests
              {pendingCount > 0 ? (
                <span
                  className="ml-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5"
                  style={{
                    background: 'var(--crimson)',
                    color: 'white',
                    minWidth: 16,
                    height: 16,
                  }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-md ml-auto">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint"
              aria-hidden
            />
            <input
              type="text"
              className="fi"
              style={{ paddingLeft: 28, paddingRight: search ? 32 : undefined }}
              placeholder={
                tab === 'clients'
                  ? 'Search by name, company, email, or client ID…'
                  : tab === 'requests'
                    ? 'Search by client name, company, or proposed value…'
                    : 'Search by client name, email, or ID…'
              }
              value={search}
              maxLength={500}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search"
            />
            {search && (
              <button
                type="button"
                className="fjb-search-x"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>

          {tab === 'clients' && (
            <button
              type="button"
              className={`btn ${hotlistedOnly ? 'btn-red' : 'btn-outline'}`}
              onClick={() => setHotlistedOnly((v) => !v)}
              aria-pressed={hotlistedOnly}
            >
              Hotlisted only
            </button>
          )}

          {tab === 'clients' && (
            <button
              type="button"
              className="btn btn-crimson"
              onClick={() => setAddClientOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Add Client
            </button>
          )}
        </div>

        {tab === 'approve' ? (
          <ClientApproveTab autoOpenUserId={autoOpenUserId} />
        ) : tab === 'requests' ? (
          <ProfileChangeRequestsTab search={debouncedSearch} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            Loading clients…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-12 text-[var(--crimson)] text-sm">
            Failed to load clients. Please refresh and try again.
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            {hotlistedOnly
              ? 'No Hotlisted clients.'
              : debouncedSearch.trim()
                ? 'No clients match your search.'
                : 'No clients found.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Client ID</th>
                    <th style={{ width: 130 }}>Contact Name</th>
                    <th style={{ width: 'auto' }}>Company</th>
                    <th style={{ width: 120 }}>Phone</th>
                    <th style={{ width: 140 }}>Location</th>
                    <th style={{ width: 100 }}>Payment</th>
                    <th style={{ width: 90 }}>Status</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} onClick={() => openClient(c, 'view')} className="cursor-pointer hover:bg-[rgba(255,255,255,0.02)]">
                      <td>
                        <span className="ref-code">{c.client_id}</span>
                      </td>
                      <td className="font-semibold">
                        <span
                          title={c.contact_name}
                          style={{
                            maxWidth: 120,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.contact_name}
                        </span>
                      </td>
                      <td className="text-text-muted">
                        <span
                          title={c.company_name ?? undefined}
                          style={{
                            maxWidth: 150,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.company_name ?? '—'}
                        </span>
                      </td>
                      <td className="font-mono text-[11.5px] text-text-muted">{c.contact_number}</td>
                      <td className="text-text-muted">
                        <span
                          title={c.location ?? undefined}
                          style={{
                            maxWidth: 160,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {c.location ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className="badge gray">
                          {c.payment_mode?.replace(/_/g, ' ') ?? '—'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className={`badge ${c.is_active ? 'green' : 'red'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {c.is_hotlisted && <span className="badge amber">Hotlisted</span>}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          ariaLabel={`Actions for ${c.contact_name}`}
                          actions={[
                            {
                              key: 'manage',
                              label: 'Manage',
                              icon: <Pencil aria-hidden className="w-3.5 h-3.5" />,
                              onSelect: () => openClient(c, 'view'),
                            },
                            {
                              key: 'hotlist',
                              label: c.is_hotlisted ? 'Remove Hotlist' : 'Mark Hotlisted',
                              icon: c.is_hotlisted ? (
                                <ShieldCheck aria-hidden className="w-3.5 h-3.5" />
                              ) : (
                                <ShieldAlert aria-hidden className="w-3.5 h-3.5" />
                              ),
                              danger: !c.is_hotlisted,
                              onSelect: () => setHotlistTarget(c),
                            },
                            {
                              key: 'status',
                              label: c.is_active ? 'Deactivate' : 'Activate',
                              icon: c.is_active ? (
                                <UserX aria-hidden className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck aria-hidden className="w-3.5 h-3.5" />
                              ),
                              danger: c.is_active,
                              disabled: !c.user_id,
                              title: c.user_id
                                ? undefined
                                : 'This client has no portal login to activate or deactivate.',
                              onSelect: () => setStatusTarget(c),
                            },
                            {
                              key: 'send-cc-form',
                              label: 'Send CC Form',
                              icon: <FileText aria-hidden className="w-3.5 h-3.5" />,
                              accent: 'crimson' as const,
                              title: c.cc_form_sent_at
                                ? `Last sent ${formatDateTime(c.cc_form_sent_at)}`
                                : 'Not sent yet',
                              onSelect: () => setSendCcFormTarget(c),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </Panel>

      {/* Page-level OTP gate — shown once per session on first visit */}
      {pageGateOpen && (
        <ClientSectionGateModal
          onVerified={() => {
            markSessionVerified();
            setPageGateOpen(false);
          }}
          onDismiss={() => navigate(-1)}
        />
      )}

      <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
      />

      <ClientDetailModal
        client={selectedClient ?? null}
        mode={selected?.mode}
        onClose={() => setSelected(null)}
      />

      <ConfirmModal
        open={statusTarget !== null}
        tone={statusTarget?.is_active ? 'destructive' : undefined}
        title={statusTarget?.is_active ? 'Deactivate client account?' : 'Reactivate client account?'}
        description={
          statusTarget?.is_active ? (
            <>
              <strong>{statusTarget.company_name ?? statusTarget.client_name}</strong> (
              {statusTarget.client_id}) will be signed out immediately and blocked from logging in
              until you reactivate them.
            </>
          ) : (
            <>
              <strong>{statusTarget?.company_name ?? statusTarget?.client_name}</strong> (
              {statusTarget?.client_id}) will regain the ability to log in and use the portal.
            </>
          )
        }
        confirmLabel={statusTarget?.is_active ? 'Deactivate' : 'Reactivate'}
        onConfirm={async () => {
          if (!statusTarget) return;
          await setActive.mutateAsync(
            { id: statusTarget.id, is_active: !statusTarget.is_active },
            { onSuccess: () => setStatusTarget(null) },
          );
        }}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmModal
        open={hotlistTarget !== null}
        tone={hotlistTarget?.is_hotlisted ? undefined : 'destructive'}
        title={hotlistTarget?.is_hotlisted ? 'Remove Hotlist status?' : 'Mark client as Hotlisted?'}
        description={
          hotlistTarget?.is_hotlisted ? (
            <>
              <strong>{hotlistTarget.company_name ?? hotlistTarget.client_name}</strong> (
              {hotlistTarget.client_id}) will regain the ability to submit new quote requests and
              orders.
            </>
          ) : (
            <>
              <strong>{hotlistTarget?.company_name ?? hotlistTarget?.client_name}</strong> (
              {hotlistTarget?.client_id}) will be blocked from submitting new quote requests or
              orders until you remove this status. Existing orders and account history stay
              accessible to them.
            </>
          )
        }
        confirmLabel={hotlistTarget?.is_hotlisted ? 'Remove Hotlist' : 'Mark Hotlisted'}
        onConfirm={async () => {
          if (!hotlistTarget) return;
          await setHotlisted.mutateAsync(
            { id: hotlistTarget.id, hotlisted: !hotlistTarget.is_hotlisted },
            { onSuccess: () => setHotlistTarget(null) },
          );
        }}
        onCancel={() => setHotlistTarget(null)}
      />

      <ConfirmModal
        open={sendCcFormTarget !== null}
        title="Send Credit Card Authorization Form?"
        description={
          <>
            The CC Authorization Form will be emailed to{' '}
            <strong>{sendCcFormTarget?.company_name ?? sendCcFormTarget?.client_name}</strong> at{' '}
            <strong>{sendCcFormTarget?.email}</strong>.
            {sendCcFormTarget?.cc_form_sent_at ? (
              <>
                {' '}
                It was last sent on {formatDateTime(sendCcFormTarget.cc_form_sent_at)}.
              </>
            ) : null}
          </>
        }
        confirmLabel="Send"
        onConfirm={async () => {
          if (!sendCcFormTarget) return;
          await sendCcForm.mutateAsync(sendCcFormTarget.id, {
            onSuccess: () => setSendCcFormTarget(null),
          });
        }}
        onCancel={() => setSendCcFormTarget(null)}
      />
    </div>
  );
}
