import { useMemo, useState } from 'react';
import { Callout, GreetingHero, JobTable, Pagination, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;

export function CSAmendmentsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [page, setPage] = useState(1);

  const amendJobs = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);
  const routed    = useMemo(
    () => amendJobs.filter((j) => j.stage === 'junior' || j.stage === 'senior'),
    [amendJobs],
  );

  const totalPages = Math.max(1, Math.ceil(amendJobs.length / PER_PAGE));
  const pageItems  = useMemo(
    () => amendJobs.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [amendJobs, page],
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
        subtitle="Client-requested post-delivery changes. Route them back to design or digitisation and track SLA on rework."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Open',            value: isLoading ? '…' : amendJobs.length },
          { accent: 'blue',    label: 'Routed Back',     value: isLoading ? '…' : routed.length    },
          { accent: 'green',   label: 'Resolved (mo.)',  value: 8                                   },
          { accent: 'purple',  label: 'Avg. Turnaround', value: '6.4h'                              },
        ]}
      />

      <Callout tone="amber">
        Amendment requests follow the original SLA priority. Confirm scope with the client before
        routing rework to avoid double passes.
      </Callout>

      <div className="mt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">Loading amendments…</div>
        ) : amendJobs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            No amendments — all good!
          </div>
        ) : (
          <>
            <JobTable jobs={pageItems} showActions defaultView="grid" emptyLabel="No amendments — all good!" />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={amendJobs.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
