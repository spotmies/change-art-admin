import { useMemo, useState } from 'react';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  Pills,
  StatGrid,
  applyJobFilters,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  type JobFilters,
  type PillItem,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';

const FETCH_SIZE = 100;
const PER_PAGE   = 20;

// Status options relevant to active production jobs (no quote / delivered states)
const PIPELINE_STATUS_OPTIONS = JOB_STATUS_OPTIONS.filter(
  (o) => !['Quote Submitted', 'Quote Approved', 'Delivered', 'Cancelled'].includes(o.value),
);

export function AdminNewJobsPage() {
  const { jobs, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const clientsQuery = useAdminClients();
  const clients = clientsQuery.data?.items ?? [];

  const [stageFilter, setStageFilter] = useState('all');
  const [filters, setFilters]         = useState<JobFilters>(EMPTY_FILTERS);
  const [page, setPage]               = useState(1);

  // Active pipeline — exclude quote stage, delivered, and cancelled.
  const active = useMemo(
    () => jobs.filter(
      (j) => j.stage !== 'quote' && j.stage !== 'delivered' && j.status !== 'Cancelled',
    ),
    [jobs],
  );

  const inProd   = useMemo(() => active.filter((j) => j.stage === 'junior'),  [active]);
  const srReview = useMemo(() => active.filter((j) => j.stage === 'senior'),  [active]);
  const inQc     = useMemo(() => active.filter((j) => j.stage === 'qc'),      [active]);
  const sewout   = useMemo(() => active.filter((j) => j.stage === 'sewout'),  [active]);

  const pills: PillItem[] = [
    { id: 'all',           label: 'All',           count: active.length },
    { id: 'In Production', label: 'In Production', count: inProd.length },
    { id: 'Senior Review', label: 'Senior Review', count: srReview.length },
    { id: 'In QC',         label: 'In QC',         count: inQc.length },
    { id: 'Sewout',        label: 'Sewout',        count: sewout.length },
  ];

  // Stage pill filter
  const stageFiltered = useMemo(() => {
    if (stageFilter === 'all') return active;
    return active.filter((j) => j.status === stageFilter);
  }, [active, stageFilter]);

  // Filter bar criteria on top of stage filter
  const filtered = useMemo(() => applyJobFilters(stageFiltered, filters), [stageFiltered, filters]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems  = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page],
  );

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
          { accent: 'teal',   label: 'Total Active',  value: isLoading ? '…' : active.length },
          { accent: 'amber',  label: 'In Production', value: isLoading ? '…' : inProd.length },
          { accent: 'purple', label: 'Senior Review', value: isLoading ? '…' : srReview.length },
          { accent: 'green',  label: 'In QC',         value: isLoading ? '…' : inQc.length },
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
            jobs={pageItems}
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
          {pageItems.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
