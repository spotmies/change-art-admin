import { useMemo } from 'react';
import { Callout, GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;

export function CSAmendmentsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });

  const amendJobs = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);
  const routed    = useMemo(
    () => amendJobs.filter((j) => j.stage === 'junior' || j.stage === 'senior'),
    [amendJobs],
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
        ) : (
          <JobTable
            jobs={amendJobs}
            showActions
            defaultView="grid"
            emptyLabel="No amendments — all good!"
          />
        )}
      </div>
    </div>
  );
}
