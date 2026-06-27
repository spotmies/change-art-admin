import { useMemo, useState } from 'react';
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

  // Hardcoded to JOB_PLACED + unacknowledged — New Jobs shows only freshly
  // placed orders that are still awaiting acknowledgement (truly "Pending").
  // JOB_PLACED jobs that have already been acknowledged show as "In Production"
  // and belong on the All Jobs view, not here.
  const queryFilters = useMemo(() => ({
    page,
    per_page: PER_PAGE,
    status: 'JOB_PLACED',
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

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    setPage(1);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="New Jobs" subtitle="Pending orders awaiting acknowledgement." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="New Jobs"
        subtitle="Pending orders placed by clients — awaiting acknowledgement and assignment."
      />

      <StatGrid
        stats={[
          { accent: 'teal', label: 'Pending Jobs', value: isLoading ? '…' : total },
          { accent: 'amber', label: 'This Page', value: isLoading ? '…' : jobs.length },
          { accent: 'blue', label: 'Page', value: isLoading ? '…' : `${page} / ${totalPages || 1}` },
        ]}
      />

      {isLoading ? (
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
