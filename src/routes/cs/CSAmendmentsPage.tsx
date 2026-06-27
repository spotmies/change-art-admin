import { useMemo, useState } from 'react';
import { Callout, GreetingHero, JobTable, Pagination, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;
const PER_PAGE = 20;

export function CSAmendmentsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);

  // Pending = client requested modification, awaiting CS/Admin action
  const pendingJobs = useMemo(
    () => allData.filter((j) => j.rawStatus === 'MODIFICATION_REQUESTED'),
    [allData],
  );

  // Active amends = modification approved, job is back in the production workflow
  const activeAmendJobs = useMemo(
    () => allData.filter((j) => j.project === 'Amend' && j.rawStatus !== 'MODIFICATION_REQUESTED' && j.rawStatus !== 'DELIVERED' && j.rawStatus !== 'CLOSED' && j.rawStatus !== 'CANCELLED'),
    [allData],
  );

  // All amend jobs for stats
  const allAmendJobs = useMemo(
    () => allData.filter((j) => j.project === 'Amend' || j.rawStatus === 'MODIFICATION_REQUESTED'),
    [allData],
  );

  const totalPages = Math.max(1, Math.ceil(allAmendJobs.length / PER_PAGE));
  const pageItems = useMemo(
    () => allAmendJobs.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [allAmendJobs, page],
  );

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Amendments" subtitle="Client-requested post-delivery changes." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load amendments. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Amendments"
        subtitle="Client-requested post-delivery changes. Review pending requests, then route approved ones back to production."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Pending Requests', value: isLoading ? '…' : pendingJobs.length },
          { accent: 'blue',    label: 'In Production',    value: isLoading ? '…' : activeAmendJobs.length },
          { accent: 'green',   label: 'Total Open',       value: isLoading ? '…' : allAmendJobs.length },
          { accent: 'purple',  label: 'Avg. Turnaround',  value: '6.4h' },
        ]}
      />

      {pendingJobs.length > 0 && (
        <Callout tone="amber">
          {pendingJobs.length} modification request{pendingJobs.length > 1 ? 's' : ''} awaiting action — review and route or reject from the job detail.
        </Callout>
      )}

      <div className="mt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            Loading amendments…
          </div>
        ) : allAmendJobs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            No amendments — all good!
          </div>
        ) : (
          <>
            <JobTable
              jobs={pageItems}
              showActions
              defaultView="grid"
              emptyLabel="No amendments — all good!"
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={allAmendJobs.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
