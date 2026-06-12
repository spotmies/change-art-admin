import { useEffect, useMemo, useState } from 'react';
import {
  GreetingHero,
  JobTable,
  Pagination,
  StatGrid,
  Pills,
  type PillItem,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;

type FilterId = 'all' | 'In Production' | 'Senior Review' | 'In QC' | 'Sewout';

export function CSNewJobsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [filter, setFilter] = useState<FilterId>('all');
  const [page, setPage] = useState(1);

  const allJobs  = useMemo(
    () => allData.filter((j) => j.stage !== 'quote' && j.stage !== 'delivered' && j.status !== 'Cancelled'),
    [allData],
  );
  const inProd   = useMemo(() => allJobs.filter((j) => j.stage === 'junior'),  [allJobs]);
  const srReview = useMemo(() => allJobs.filter((j) => j.stage === 'senior'),  [allJobs]);
  const inQc     = useMemo(() => allJobs.filter((j) => j.stage === 'qc'),      [allJobs]);
  const sewout   = useMemo(() => allJobs.filter((j) => j.stage === 'sewout'),  [allJobs]);

  const pills: PillItem[] = [
    { id: 'all',           label: 'All',            count: allJobs.length  },
    { id: 'In Production', label: 'In Production',  count: inProd.length   },
    { id: 'Senior Review', label: 'Senior Review',  count: srReview.length },
    { id: 'In QC',         label: 'In QC',          count: inQc.length     },
    { id: 'Sewout',        label: 'Sewout',          count: sewout.length   },
  ];

  const filtered = useMemo(() => {
    if (filter === 'all') return allJobs;
    return allJobs.filter((j) => j.status === filter);
  }, [filter, allJobs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems  = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page],
  );

  useEffect(() => { setPage(1); }, [filter]);

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="New Jobs" subtitle="All active production jobs." />
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
        subtitle="All active production jobs — track status, assign, and manage the pipeline."
      />

      <StatGrid
        stats={[
          { accent: 'teal',   label: 'Total Active',  value: isLoading ? '…' : allJobs.length  },
          { accent: 'amber',  label: 'In Production', value: isLoading ? '…' : inProd.length   },
          { accent: 'blue',   label: 'Senior Review', value: isLoading ? '…' : srReview.length },
          { accent: 'green',  label: 'In QC',         value: isLoading ? '…' : inQc.length     },
        ]}
      />

      <Pills items={pills} activeId={filter} onSelect={(id) => setFilter(id as FilterId)} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading jobs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          No active jobs matching this filter.
        </div>
      ) : (
        <>
          <JobTable jobs={pageItems} showActions defaultView="grid" />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
