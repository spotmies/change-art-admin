import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  type JobFilters,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';

const PER_PAGE = 20;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function mapOrderType(display: string): string | undefined {
  switch (display) {
    case 'Artwork': return 'ARTWORK';
    case 'Digitizing': return 'DIGITIZING';
    case 'Digitizing + Sewout': return 'DIGITIZING_SEWOUT';
    case 'Others': return 'OTHERS';
    default: return undefined;
  }
}

function mapPriority(display: string): string | undefined {
  switch (display) {
    case 'Normal': return 'NORMAL';
    case 'Rush': return 'RUSH';
    case 'Super Rush': return 'SUPER_RUSH';
    default: return undefined;
  }
}

function mapStatusFilter(display: string): { status?: string; stage?: string; statuses?: string; unacknowledged?: boolean } {
  switch (display) {
    case 'Order Placed':
      return { status: 'JOB_PLACED' };
    case 'Pending':
      // JOB_PLACED jobs that haven't been acknowledged yet (display as "Pending" in the adapter)
      return { status: 'JOB_PLACED', unacknowledged: true };
    case 'In Production':
      // Statuses that always display as "In Production" — excludes JOB_PLACED which
      // shows as "Pending" until the CS acknowledgement is sent.
      return { statuses: 'CS_APPROVED,ASSIGNED,IN_PROGRESS,SENIOR_REJECTED,QC_REJECTED' };
    case 'Senior Review':
      return { stage: 'senior' };
    case 'Sewout':
      return { stage: 'sewout' };
    case 'In QC':
      return { stage: 'qc' };
    case 'Ready to Deliver':
      return { status: 'READY_TO_DELIVER' };
    case 'On Hold':
      return { status: 'HOLD' };
    case 'Dispatched':
      return { status: 'DELIVERED' };
    case 'Amend':
      return { status: 'MODIFICATION_REQUESTED' };
    case 'Cancelled':
      return { status: 'CANCELLED' };
    default:
      return {};
  }
}

const VALID_STATUS_VALUES = new Set(JOB_STATUS_OPTIONS.map((o) => o.value));

export function AdminJobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openJobId = searchParams.get('open');

  // Pre-seed status filter from ?filter= URL param (used by dashboard stat cards).
  // Validate against the known option list to reject junk values.
  const filterParam = searchParams.get('filter') ?? '';
  const initialStatus = VALID_STATUS_VALUES.has(filterParam) ? filterParam : '';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>({ ...EMPTY_FILTERS, status: initialStatus });

  const debouncedSearch = useDebounced(filters.search, 300);
  // per_page: 500 — needed to populate the client filter dropdown with all client names.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  const clientUuid = useMemo(() => {
    if (!filters.clientId) return undefined;
    const found = clients.find((c) => c.client_id === filters.clientId);
    return found ? found.id : undefined;
  }, [filters.clientId, clients]);

  const mappedStatus = useMemo(() => mapStatusFilter(filters.status), [filters.status]);

  const queryFilters = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      search: debouncedSearch.trim() || undefined,
      order_type: mapOrderType(filters.orderType),
      priority: mapPriority(filters.priority),
      client_id: clientUuid,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      ...mappedStatus,
    }),
    [page, debouncedSearch, filters.orderType, filters.priority, clientUuid, filters.dateFrom, filters.dateTo, mappedStatus],
  );

  const { jobs, total, isLoading, isError } = useAdminJobViews(queryFilters);
  const totalPages = Math.ceil((total || 0) / PER_PAGE);

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
        <GreetingHero title="All Jobs" subtitle="Every job across the platform." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title={initialStatus ? `${initialStatus} Jobs` : 'All Jobs'}
        subtitle={`${initialStatus ? `Showing ${initialStatus.toLowerCase()} jobs.` : 'Every job across the platform — search, filter by type, priority, client, or date.'}${total > 0 ? ` ${total} total.` : ''}`}
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
            initialOpenJobId={openJobId}
            onInitialOpenHandled={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('open');
              setSearchParams(next, { replace: true });
            }}
            toolbarSlot={
              <JobFilterBar
                filters={filters}
                onChange={handleFiltersChange}
                statusOptions={JOB_STATUS_OPTIONS}
                clients={clients}
              />
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
