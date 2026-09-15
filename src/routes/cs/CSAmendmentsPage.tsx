import { useMemo, useState } from 'react';
import { GreetingHero, JobTable, Pagination, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;
const PER_PAGE = 20;

export function CSAmendmentsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);

  // A modification request only becomes an Amend project once staff
  // approves it (workflow action `cs_amend_reroute`, MODIFICATION_REQUESTED
  // → CS_APPROVED). A request still awaiting that decision lives on New
  // Requests instead — see job-cards.schemas.ts's `view` doc comment — so
  // this page only ever shows already-approved amends back in the pipeline.
  const activeAmendJobs = useMemo(
    () => allData.filter((j) => j.project === 'Amend' && j.rawStatus !== 'MODIFICATION_REQUESTED' && j.rawStatus !== 'DELIVERED' && j.rawStatus !== 'CLOSED' && j.rawStatus !== 'CANCELLED'),
    [allData],
  );

  const readyToDispatchAmends = useMemo(
    () => activeAmendJobs.filter((j) => j.status === 'Ready to Deliver'),
    [activeAmendJobs],
  );

  const totalPages = Math.max(1, Math.ceil(activeAmendJobs.length / PER_PAGE));
  const pageItems = useMemo(
    () => activeAmendJobs.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [activeAmendJobs, page],
  );

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Amendments" subtitle="Client-requested post-delivery changes." />
        <div className="flex items-center justify-center py-16 text-[var(--color-crimson)] text-sm">
          Failed to load amendments. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Amendments"
        subtitle="Approved post-delivery changes back in production. New modification requests are reviewed from New Requests first."
      />

      <StatGrid
        stats={[
          { accent: 'blue',   label: 'In Production',    value: isLoading ? '…' : activeAmendJobs.length },
          { accent: 'teal',   label: 'Ready to Dispatch', value: isLoading ? '…' : readyToDispatchAmends.length },
          { accent: 'purple', label: 'Avg. Turnaround',  value: '6.4h' },
        ]}
      />

      <div className="mt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            Loading amendments…
          </div>
        ) : activeAmendJobs.length === 0 ? (
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
              total={activeAmendJobs.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
