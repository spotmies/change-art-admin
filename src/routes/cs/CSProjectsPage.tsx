import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  StatGrid,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  applyJobFilters,
  type JobFilters,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { isJobEtaExpired } from '@lib/utils';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;
const VALID_STATUS_VALUES = new Set(JOB_STATUS_OPTIONS.map((o) => o.value));

export function CSProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openJobId = searchParams.get('open');
  // Pre-seed a status filter from ?filter= (used by the CS dashboard stat cards).
  // Validate against the known option list to reject junk/unmapped values.
  const rawFilterParam = searchParams.get('filter') ?? '';
  const filterParam = VALID_STATUS_VALUES.has(rawFilterParam) ? rawFilterParam : '';
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>({ ...EMPTY_FILTERS, status: filterParam });

  // per_page: 500 — needed to populate the client filter dropdown with all client names.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  // Keep the filter bar's status in sync if the URL's ?filter= changes
  // (e.g. navigating here again from a different dashboard stat card).
  useEffect(() => {
    setFilters((prev) => ({ ...prev, status: filterParam }));
  }, [filterParam]);

  const open       = useMemo(() => allData.filter((j) => j.stage !== 'delivered' && !isJobEtaExpired(j)), [allData]);
  const ready      = useMemo(() => allData.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)), [allData]);
  const amend      = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);

  const filteredData = useMemo(() => applyJobFilters(allData, filters), [allData, filters]);

  // Reset to page 1 whenever the active filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PER_PAGE));
  const pageItems  = useMemo(
    () => filteredData.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredData, page],
  );

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    // The status filter no longer matches whatever ?filter= seeded it with
    // once the user picks a different one from the dropdown — drop the URL
    // param so the "Clear filter" pill in the header doesn't show stale text.
    if (next.status !== filterParam) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('filter');
      setSearchParams(nextParams, { replace: true });
    }
  }

  function clearFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
    setFilters(EMPTY_FILTERS);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="All Projects" subtitle="All jobs across the Client Servicing pipeline." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load projects. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="All Projects"
        subtitle={
          filterParam
            ? `Showing ${filterParam.toLowerCase()} jobs.`
            : 'Browse every active, delivered, and amendment job across the Client Servicing pipeline.'
        }
        action={
          filterParam ? (
            <button type="button" className="btn btn-outline" onClick={clearFilter}>
              Clear filter: {filterParam} ✕
            </button>
          ) : undefined
        }
      />

      <StatGrid
        stats={[
          { accent: 'blue',   label: 'Total Projects',   value: isLoading ? '…' : allData.length },
          { accent: 'amber',  label: 'Open',             value: isLoading ? '…' : open.length    },
          { accent: 'teal',   label: 'Ready to Dispatch', value: isLoading ? '…' : ready.length   },
          { accent: 'purple', label: 'Amendments',       value: isLoading ? '…' : amend.length   },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading projects…
        </div>
      ) : filteredData.length === 0 ? (
        <>
          <JobFilterBar
            filters={filters}
            onChange={handleFiltersChange}
            statusOptions={JOB_STATUS_OPTIONS}
            clients={clients}
          />
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            {filterParam ? `No ${filterParam.toLowerCase()} jobs.` : 'No projects match these filters.'}
          </div>
        </>
      ) : (
        <>
          <JobTable
            jobs={pageItems}
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
            total={filteredData.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
