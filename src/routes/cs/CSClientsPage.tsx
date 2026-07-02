import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { GreetingHero, Pagination, Panel, StatGrid } from '@modules/shared-ui';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { ClientSectionGateModal } from '../../modules/admin-panel/components/ClientSectionGateModal';

const PER_PAGE = 20;

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
    // sessionStorage unavailable
  }
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function currentMonthCount(items: { created_at: string }[]): number {
  const now = new Date();
  return items.filter((c) => {
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

export function CSClientsPage() {
  const navigate = useNavigate();
  const [pageGateOpen, setPageGateOpen] = useState(() => !isSessionVerified());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const filters = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [page, debouncedSearch],
  );

  const { data, isLoading, isError } = useAdminClients(filters);

  const clients = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.total_pages ?? 1;

  return (
    <div className="page">
      <GreetingHero
        title="Client Records"
        subtitle="Master list of every client account — contact details, account health, lifetime volume, and recent activity."
      />

      <StatGrid
        stats={[
          { accent: 'blue',    label: 'Active Accounts', value: isLoading ? '…' : total },
          { accent: 'green',   label: 'New (mo.)',        value: isLoading ? '…' : currentMonthCount(clients) },
          { accent: 'crimson', label: 'At Risk',          value: 0 },
          {
            accent: 'gold',
            label: 'Top Client',
            value: isLoading ? '…' : (clients[0]?.company_name ?? clients[0]?.client_name ?? '—'),
          },
        ]}
      />

      <Panel title={`All Clients${total ? ` (${total})` : ''}`}>
        <div className="relative mb-3 max-w-md">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint"
            aria-hidden
          />
          <input
            type="text"
            className="fi"
            style={{ paddingLeft: 28, paddingRight: search ? 32 : undefined }}
            placeholder="Search by name, company, email, or client ID…"
            value={search}
            maxLength={500}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            Loading clients…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-12 text-[var(--crimson)] text-sm">
            Failed to load clients. Please refresh and try again.
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">
            {debouncedSearch.trim() ? 'No clients match your search.' : 'No clients found.'}
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
                    <th>Location</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td><span className="ref-code">{c.client_id}</span></td>
                      <td className="font-semibold">{c.contact_name}</td>
                      <td className="text-text-muted">{c.company_name ?? '—'}</td>
                      <td className="font-mono text-[11.5px] text-text-muted">{c.contact_number}</td>
                      <td className="text-text-muted">{c.location ?? '—'}</td>
                      <td>
                        <span className="badge gray">
                          {c.payment_mode?.replace(/_/g, ' ') ?? '—'}
                        </span>
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
    </div>
  );
}
