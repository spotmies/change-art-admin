import { useMemo, useState } from 'react';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  Pills,
  StatGrid,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  type JobFilters,
  type PillItem,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { useDebounced } from '@lib/use-debounced';

const PER_PAGE = 20;

// Status options relevant to active production jobs (no quote / delivered states)
const PIPELINE_STATUS_OPTIONS = JOB_STATUS_OPTIONS.filter(
  (o) => !['Quote Submitted', 'Quote Approved', 'Delivered', 'Cancelled'].includes(o.value),
);

/** Map the stage-pill selection to a backend stage param. */
function stageToParam(stageFilter: string): { stage?: string; exclude_stage?: string } {
  switch (stageFilter) {
    case 'In Production': return { stage: 'junior' };
    case 'Senior Review': return { stage: 'senior' };
    case 'In QC':         return { stage: 'qc' };
    case 'Sewout':        return { stage: 'sewout' };
    default:              return { exclude_stage: 'quote' }; // "all" — exclude quotes & delivered
  }
}

/** Map the filter-bar order type to the backend order_type enum value. */
function mapOrderType(ot: string): string | undefined {
  if (ot === 'Artwork')            return 'ARTWORK';
  if (ot === 'Digitizing')         return 'DIGITIZING';
  if (ot === 'Digitizing + Sewout') return 'DIGITIZING_SEWOUT';
  return undefined;
}

/** Map filter-bar priority to backend Priority enum. */
function mapPriority(p: string): string | undefined {
  if (p === 'Normal')     return 'NORMAL';
  if (p === 'Rush')       return 'RUSH';
  if (p === 'Super Rush') return 'SUPER_RUSH';
  return undefined;
}

export function AdminNewJobsPage() {
  const [stageFilter, setStageFilter] = useState('all');
  const [filters, setFilters]         = useState<JobFilters>(EMPTY_FILTERS);
  const [page, setPage]               = useState(1);

  const debouncedSearch = useDebounced(filters.search, 300);

  // per_page: 500 — needed to populate the client filter dropdown with all client names.
  // React Query deduplicates this with the same call in useAdminJobViews, so only
  // one network request goes out regardless of how many components call this hook.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  // Resolve the selected client display-id (e.g. "CLI0002") to a database UUID
  // so the backend can filter job cards by exact client_id foreign key.
  const clientUuid = useMemo(() => {
    if (!filters.clientId) return undefined;
    return clients.find((c) => c.client_id === filters.clientId)?.id;
  }, [filters.clientId, clients]);

  // Build the server-side query: 20 records per page, all filters pushed to backend.
  const queryFilters = useMemo(() => ({
    page,
    per_page: PER_PAGE,
    search: debouncedSearch.trim() || undefined,
    order_type: mapOrderType(filters.orderType),
    priority: mapPriority(filters.priority),
    client_id: clientUuid,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    ...stageToParam(stageFilter),
  }), [page, debouncedSearch, filters.orderType, filters.priority, clientUuid, filters.dateFrom, filters.dateTo, stageFilter]);

  const { jobs, total, isLoading, isError } = useAdminJobViews(queryFilters);

  const totalPages = Math.ceil(total / PER_PAGE);

  // Stage pills — counts come from the full server total (current filter scope only).
  // We show the count for the active pill from meta.total; inactive pills don't have
  // separate server counts without extra requests so we omit them (dash).
  const pills: PillItem[] = [
    { id: 'all',           label: 'All Production' },
    { id: 'In Production', label: 'In Production' },
    { id: 'Senior Review', label: 'Senior Review' },
    { id: 'In QC',         label: 'In QC' },
    { id: 'Sewout',        label: 'Sewout' },
  ];

  function handleStageChange(id: string) {
    setStageFilter(id);
    setPage(1);
  }

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    setPage(1);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="New Jobs" subtitle="Active pipeline." />
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
        subtitle="Active pipeline — new requests, in-production work, QC, and sewout all in one view."
      />

      <StatGrid
        stats={[
          { accent: 'teal',  label: 'Jobs in View',  value: isLoading ? '…' : total },
          { accent: 'amber', label: 'This Page',     value: isLoading ? '…' : jobs.length },
          { accent: 'blue',  label: 'Page',          value: isLoading ? '…' : `${page} / ${totalPages || 1}` },
        ]}
      />

      <Pills items={pills} activeId={stageFilter} onSelect={handleStageChange} />

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
            emptyLabel="No jobs match the current filters."
            toolbarSlot={
              <JobFilterBar
                filters={filters}
                onChange={handleFiltersChange}
                statusOptions={PIPELINE_STATUS_OPTIONS}
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
