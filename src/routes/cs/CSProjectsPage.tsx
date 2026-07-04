import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GreetingHero, JobTable, Pagination, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { isJobEtaExpired } from '@lib/utils';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;

export function CSProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openJobId = searchParams.get('open');
  // Pre-seed a status filter from ?filter= (used by the CS dashboard stat cards).
  const filterParam = searchParams.get('filter') ?? '';
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);

  const open       = useMemo(() => allData.filter((j) => j.stage !== 'delivered' && !isJobEtaExpired(j)), [allData]);
  const ready      = useMemo(() => allData.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)), [allData]);
  const amend      = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);

  const filteredData = useMemo(
    () => (filterParam ? allData.filter((j) => j.status === filterParam) : allData),
    [allData, filterParam],
  );

  // Reset to page 1 whenever the active filter changes.
  useEffect(() => {
    setPage(1);
  }, [filterParam]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PER_PAGE));
  const pageItems  = useMemo(
    () => filteredData.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredData, page],
  );

  function clearFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
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
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          {filterParam ? `No ${filterParam.toLowerCase()} jobs.` : 'No projects yet.'}
        </div>
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
