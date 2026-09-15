import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GreetingHero,
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
  if (ot === 'Others')              return 'OTHERS';
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
  const [awaitingFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [awaitingPage, setAwaitingPage]       = useState(1);

  const debouncedAwaitingSearch = useDebounced(awaitingFilters.search, 300);

  // per_page: 500 — populate client filter dropdowns.
  // Shared cache key with useAdminJobViews → one network request.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const awaitingClientUuid = useMemo(() => {
    if (!awaitingFilters.clientId) return undefined;
    return clients.find((c) => c.client_id === awaitingFilters.clientId)?.id;
  }, [awaitingFilters.clientId, clients]);

  // ── "Awaiting Client" / "Awaiting ETA" — server-side paginated ──
  // QUOTE_SUBMITTED (not yet priced) lives on the New Requests queue
  // instead. This page covers everything after a price is sent: quotes
  // awaiting the client's confirmation (QUOTE_APPROVED) AND quotes the
  // client already confirmed but that are still waiting on staff to send
  // an ETA (project_type LIVE_QUOTE, JOB_PLACED, unacknowledged) — those
  // stay here, not on New Requests, until ETA moves them to Live Quote.
  const awaitingQuery = useAdminJobViews(useMemo(() => ({
    page: awaitingPage,
    per_page: PER_PAGE,
    view: 'quote_awaiting' as const,
    search: debouncedAwaitingSearch.trim() || undefined,
    order_type: mapOrderType(awaitingFilters.orderType),
    priority: mapPriority(awaitingFilters.priority),
    client_id: awaitingClientUuid,
    date_from: awaitingFilters.dateFrom || undefined,
    date_to: awaitingFilters.dateTo || undefined,
  }), [awaitingPage, debouncedAwaitingSearch, awaitingFilters.orderType, awaitingFilters.priority, awaitingClientUuid, awaitingFilters.dateFrom, awaitingFilters.dateTo]));

  const awaitingPages = Math.ceil(awaitingQuery.total / PER_PAGE);

  const isLoading = awaitingQuery.isLoading;
  const isError   = awaitingQuery.isError;

  const hasLoadedOnce = useRef(false);
  useEffect(() => { if (!isLoading) hasLoadedOnce.current = true; }, [isLoading]);
  const isFirstLoad = isLoading && !hasLoadedOnce.current;



  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Quotes" subtitle="Priced quotes awaiting client confirmation." />
        <div className="flex items-center justify-center py-16 text-[var(--color-crimson)] text-sm">
          Failed to load quotes. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Quotes"
        subtitle="Quotes your team has priced and sent — waiting on the client to confirm before they go live."
      />

      <StatGrid
        stats={[
          { accent: 'amber', label: 'Awaiting Client', value: isLoading ? '…' : awaitingQuery.total },
        ]}
      />

      {isFirstLoad ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading quotes…
        </div>
      ) : (
        <>
          <SectionHeader title="Price Sent — Awaiting Client" />
          <JobTable
            jobs={awaitingQuery.jobs}
            showActions
            defaultView="grid"
            quoteView
            emptyLabel="No quotes awaiting client confirmation."
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
        </>
      )}
    </div>
  );
}
