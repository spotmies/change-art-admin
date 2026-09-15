import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GreetingHero,
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
  const [filters] = useState<JobFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(filters.search, 300);

  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const clientUuid = useMemo(() => {
    if (!filters.clientId) return undefined;
    return clients.find((c) => c.client_id === filters.clientId)?.id;
  }, [filters.clientId, clients]);

  // New Requests = anything the CS team hasn't acted on yet:
  // - Direct orders: JOB_PLACED with no ETA sent (unacknowledged).
  // - Quote requests: QUOTE_SUBMITTED — client asked for a quote, no price
  //   sent yet.
  // Once a price is sent (QUOTE_APPROVED) it moves to the Quote queue
  // instead, and a confirmed-but-not-yet-acknowledged quote (project_type
  // LIVE_QUOTE) STAYS on the Quote queue until ETA is sent — it doesn't
  // pass back through here. See job-cards.schemas.ts's `view` doc comment
  // for the exact bucket definition this mirrors server-side.
  const queryFilters = useMemo(() => ({
    page,
    per_page: PER_PAGE,
    view: 'new_requests' as const,
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



  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="New Jobs" subtitle="New orders, quote requests, and modification requests awaiting your response." />
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
        subtitle="Direct orders awaiting ETA, quote requests waiting on a price, and modification requests awaiting review."
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
