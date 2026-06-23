import { useMemo, useState } from 'react';
import { GreetingHero, JobTable, Pagination, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { isJobEtaExpired } from '@lib/utils';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;

export function CSProjectsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);

  const open       = useMemo(() => allData.filter((j) => j.stage !== 'delivered' && !isJobEtaExpired(j)), [allData]);
  const ready      = useMemo(() => allData.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)), [allData]);
  const amend      = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);

  const totalPages = Math.max(1, Math.ceil(allData.length / PER_PAGE));
  const pageItems  = useMemo(
    () => allData.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [allData, page],
  );

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="All Projects" subtitle="All jobs across the CS pipeline." />
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
        subtitle="Browse every active, delivered, and amendment job across the CS pipeline."
      />

      <StatGrid
        stats={[
          { accent: 'blue',   label: 'Total Projects',   value: isLoading ? '…' : allData.length },
          { accent: 'amber',  label: 'Open',             value: isLoading ? '…' : open.length    },
          { accent: 'teal',   label: 'Ready to Deliver', value: isLoading ? '…' : ready.length   },
          { accent: 'purple', label: 'Amendments',       value: isLoading ? '…' : amend.length   },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading projects…
        </div>
      ) : allData.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          No projects yet.
        </div>
      ) : (
        <>
          <JobTable jobs={pageItems} showActions defaultView="grid" />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={allData.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
