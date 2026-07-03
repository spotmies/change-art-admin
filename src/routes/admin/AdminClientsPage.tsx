import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { GreetingHero, Pagination, Panel, StatGrid } from '@modules/shared-ui';
import { PaymentMode } from '@contracts';
import type { IClient } from '@contracts';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
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

function formatPaymentMode(mode: PaymentMode | null): string {
  if (!mode) return '—';
  const map: Record<PaymentMode, string> = {
    [PaymentMode.CREDIT_CARD]: 'Credit Card',
    [PaymentMode.CARD_ON_FILE]: 'Card on File',
    [PaymentMode.ACH]: 'ACH',
    [PaymentMode.PAYPAL]: 'PayPal',
    [PaymentMode.CHECK]: 'Check',
  };
  return map[mode] ?? mode;
}

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
  const [selected, setSelected] = useState<{ client: IClient; mode: ClientModalMode } | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);

  function openClient(client: IClient, mode: ClientModalMode) {
    setSelected({ client, mode });
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
              Client Approve
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
                    <th>Client ID</th>
                    <th>Contact Name</th>
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Location</th>
                    <th>Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="ref-code">{c.client_id}</span>
                        {c.is_hotlisted && (
                          <span className="badge red" style={{ marginLeft: 6 }}>
                            Hotlisted
                          </span>
                        )}
                      </td>
                      <td className="font-semibold">{c.contact_name}</td>
                      <td className="text-text-muted">{c.company_name ?? '—'}</td>
                      <td className="font-mono text-[11.5px] text-text-muted">{c.contact_number}</td>
                      <td className="text-text-muted">••••••••••</td>
                      <td className="text-text-muted">{c.location ?? '—'}</td>
                      <td><span className="badge gray">{formatPaymentMode(c.payment_mode)}</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline"
                          aria-label={`Edit ${c.contact_name}`}
                          onClick={() => openClient(c, 'edit')}
                        >
                          <Pencil aria-hidden className="w-3.5 h-3.5" />
                          Edit
                        </button>
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
        client={selected?.client ?? null}
        mode={selected?.mode}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
