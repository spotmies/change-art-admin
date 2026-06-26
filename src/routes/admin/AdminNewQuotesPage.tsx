import { useMemo, useState } from 'react';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  SectionHeader,
  StatGrid,
  EMPTY_FILTERS,
  type JobFilters,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { useDebounced } from '@lib/use-debounced';

const PER_PAGE = 20;

/** Map filter-bar order type → backend order_type enum. */
function mapOrderType(ot: string): string | undefined {
  if (ot === 'Artwork')             return 'ARTWORK';
  if (ot === 'Digitizing')          return 'DIGITIZING';
  if (ot === 'Digitizing + Sewout') return 'DIGITIZING_SEWOUT';
  return undefined;
}

/** Map filter-bar priority → backend Priority enum. */
function mapPriority(p: string): string | undefined {
  if (p === 'Normal')     return 'NORMAL';
  if (p === 'Rush')       return 'RUSH';
  if (p === 'Super Rush') return 'SUPER_RUSH';
  return undefined;
}

export function AdminNewQuotesPage() {
  const [pendingFilters, setPendingFilters]   = useState<JobFilters>(EMPTY_FILTERS);
  const [awaitingFilters, setAwaitingFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [pendingPage, setPendingPage]         = useState(1);
  const [awaitingPage, setAwaitingPage]       = useState(1);

  const debouncedPendingSearch  = useDebounced(pendingFilters.search,  300);
  const debouncedAwaitingSearch = useDebounced(awaitingFilters.search, 300);

  // per_page: 500 — populate client filter dropdowns.
  // Shared cache key with useAdminJobViews → one network request.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const pendingClientUuid = useMemo(() => {
    if (!pendingFilters.clientId) return undefined;
    return clients.find((c) => c.client_id === pendingFilters.clientId)?.id;
  }, [pendingFilters.clientId, clients]);

  const awaitingClientUuid = useMemo(() => {
    if (!awaitingFilters.clientId) return undefined;
    return clients.find((c) => c.client_id === awaitingFilters.clientId)?.id;
  }, [awaitingFilters.clientId, clients]);

  // ── "Pending Your Review" — QUOTE_SUBMITTED jobs, server-side paginated ──
  const pendingQuery = useAdminJobViews(useMemo(() => ({
    page: pendingPage,
    per_page: PER_PAGE,
    status: 'QUOTE_SUBMITTED',
    search: debouncedPendingSearch.trim() || undefined,
    order_type: mapOrderType(pendingFilters.orderType),
    priority: mapPriority(pendingFilters.priority),
    client_id: pendingClientUuid,
    date_from: pendingFilters.dateFrom || undefined,
    date_to: pendingFilters.dateTo || undefined,
  }), [pendingPage, debouncedPendingSearch, pendingFilters.orderType, pendingFilters.priority, pendingClientUuid, pendingFilters.dateFrom, pendingFilters.dateTo]));

  // ── "Price Sent — Awaiting Client" — QUOTE_APPROVED jobs, server-side paginated ──
  const awaitingQuery = useAdminJobViews(useMemo(() => ({
    page: awaitingPage,
    per_page: PER_PAGE,
    status: 'QUOTE_APPROVED',
    search: debouncedAwaitingSearch.trim() || undefined,
    order_type: mapOrderType(awaitingFilters.orderType),
    priority: mapPriority(awaitingFilters.priority),
    client_id: awaitingClientUuid,
    date_from: awaitingFilters.dateFrom || undefined,
    date_to: awaitingFilters.dateTo || undefined,
  }), [awaitingPage, debouncedAwaitingSearch, awaitingFilters.orderType, awaitingFilters.priority, awaitingClientUuid, awaitingFilters.dateFrom, awaitingFilters.dateTo]));

  const pendingPages  = Math.ceil(pendingQuery.total  / PER_PAGE);
  const awaitingPages = Math.ceil(awaitingQuery.total / PER_PAGE);

  const isLoading = pendingQuery.isLoading || awaitingQuery.isLoading;
  const isError   = pendingQuery.isError   || awaitingQuery.isError;

  function handlePendingFiltersChange(next: JobFilters) {
    setPendingFilters(next);
    setPendingPage(1);
  }

  function handleAwaitingFiltersChange(next: JobFilters) {
    setAwaitingFilters(next);
    setAwaitingPage(1);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Quote Requests" subtitle="Incoming quote requests across all Client Servicing." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load quotes. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Quote Requests"
        subtitle="Incoming quote requests across all Client Servicing — track turnaround pressure, value, and conversion rate."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Pending Review',  value: isLoading ? '…' : pendingQuery.total },
          { accent: 'amber',   label: 'Awaiting Client', value: isLoading ? '…' : awaitingQuery.total },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading quotes…
        </div>
      ) : (
        <>
          <SectionHeader title="Pending Your Review" />
          <JobTable
            jobs={pendingQuery.jobs}
            showActions
            defaultView="grid"
            emptyLabel="No pending quotes match the current filters."
            quoteView
            toolbarSlot={
              <JobFilterBar
                filters={pendingFilters}
                onChange={handlePendingFiltersChange}
                statusOptions={[]}
                clients={clients}
              />
            }
          />
          {pendingQuery.total > 0 && (
            <Pagination
              page={pendingPage}
              totalPages={pendingPages}
              total={pendingQuery.total}
              perPage={PER_PAGE}
              onPageChange={setPendingPage}
            />
          )}

          <div className="mt-6">
            <SectionHeader title="Price Sent — Awaiting Client" />
            <JobTable
              jobs={awaitingQuery.jobs}
              showActions
              defaultView="grid"
              quoteView
              emptyLabel="No awaiting client quotes match the current filters."
              toolbarSlot={
                <JobFilterBar
                  filters={awaitingFilters}
                  onChange={handleAwaitingFiltersChange}
                  statusOptions={[]}
                  clients={clients}
                />
              }
            />
            {awaitingQuery.total > 0 && (
              <Pagination
                page={awaitingPage}
                totalPages={awaitingPages}
                total={awaitingQuery.total}
                perPage={PER_PAGE}
                onPageChange={setAwaitingPage}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
