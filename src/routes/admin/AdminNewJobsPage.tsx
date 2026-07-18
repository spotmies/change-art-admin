import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  StatGrid,
  EMPTY_FILTERS,
  type JobFilters,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { useDebounced } from '@lib/use-debounced';

const PER_PAGE = 24;

function mapOrderType(ot: string): string | undefined {
  if (ot === 'Artwork') return 'ARTWORK';
  if (ot === 'Digitizing') return 'DIGITIZING';
  if (ot === 'Digitizing + Sewout') return 'DIGITIZING_SEWOUT';
  if (ot === 'Others') return 'OTHERS';
  return undefined;
}

function mapPriority(p: string): string | undefined {
  if (p === 'Normal') return 'NORMAL';
  if (p === 'Rush') return 'RUSH';
  if (p === 'Super Rush') return 'SUPER_RUSH';
  return undefined;
}

export function AdminNewJobsPage() {
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(filters.search, 300);

  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const clientUuid = useMemo(() => {
    if (!filters.clientId) return undefined;
    return clients.find((c) => c.client_id === filters.clientId)?.id;
  }, [filters.clientId, clients]);

  // Show both pending orders (JOB_PLACED, unacknowledged) and quotes the CS
  // team has already priced (QUOTE_APPROVED — admin_price set, awaiting the
  // client's confirmation). QUOTE_SUBMITTED (client requested a quote but no
  // price has been set yet) intentionally excluded — that's not "submitted by
  // admin" and belongs on the Quotes queue instead.
  // unacknowledged is safe to apply globally: acknowledgement_sent_at is only
  // ever set on JOB_PLACED jobs (see cs-panel.service.ts#acknowledge), so it
  // never excludes QUOTE_APPROVED rows.
  const queryFilters = useMemo(() => ({
    page,
    per_page: PER_PAGE,
    statuses: 'JOB_PLACED,QUOTE_APPROVED',
    unacknowledged: true,
    search: debouncedSearch.trim() || undefined,
    order_type: mapOrderType(filters.orderType),
    priority: mapPriority(filters.priority),
    client_id: clientUuid,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
  }), [page, debouncedSearch, filters.orderType, filters.priority, clientUuid, filters.dateFrom, filters.dateTo]);

  const { jobs, total, isLoading, isError } = useAdminJobViews(queryFilters);
  const totalPages = Math.ceil(total / PER_PAGE);

  const hasLoadedOnce = useRef(false);
  useEffect(() => { if (!isLoading) hasLoadedOnce.current = true; }, [isLoading]);
  const isFirstLoad = isLoading && !hasLoadedOnce.current;

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    setPage(1);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="New Jobs" subtitle="Pending orders awaiting acknowledgement." />
        <div className="flex items-center justify-center py-16 text-[var(--color-crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="New Jobs"
        subtitle="Pending orders awaiting acknowledgement, plus quotes you've priced and sent to the client."
      />

      <StatGrid
        stats={[
          { accent: 'teal', label: 'Active Jobs', value: isLoading ? '…' : total },
          { accent: 'amber', label: 'This Page', value: isLoading ? '…' : jobs.length },
          { accent: 'blue', label: 'Page', value: isLoading ? '…' : `${page} / ${totalPages || 1}` },
        ]}
      />

      {isFirstLoad ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading jobs…
        </div>
      ) : (
        <>
          <JobTable
            jobs={jobs}
            showActions
            defaultView="grid"
            emptyLabel="No pending jobs."
            toolbarSlot={
              <JobFilterBar
                filters={filters}
                onChange={handleFiltersChange}
                statusOptions={[]}
                clients={clients}
              />
            }
          />
          {total > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
