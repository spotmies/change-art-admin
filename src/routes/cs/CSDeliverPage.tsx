import { useMemo } from 'react';
import { Callout, GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;

export function CSDeliverPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });

  const readyJobs      = useMemo(() => allData.filter((j) => j.status === 'Ready to Deliver'), [allData]);
  const delivered      = useMemo(() => allData.filter((j) => j.stage === 'delivered' && j.status === 'Delivered'), [allData]);
  const deliveredToday = useMemo(() => delivered.filter((j) => isToday(j.created)), [delivered]);

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Ready to Deliver" subtitle="Jobs cleared QC and ready for release." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Ready to Deliver"
        subtitle="Jobs that have cleared QC and are ready to release to the client."
      />

      <StatGrid
        stats={[
          { accent: 'teal',  label: 'Ready Now',       value: isLoading ? '…' : readyJobs.length,     delta: 'QC approved'  },
          { accent: 'amber', label: 'Awaiting Files',  value: 0                                                              },
          { accent: 'green', label: 'Delivered Today', value: isLoading ? '…' : deliveredToday.length                       },
          { accent: 'blue',  label: 'Delivered (mo.)', value: isLoading ? '…' : delivered.length                            },
        ]}
      />

      <Callout tone="info">
        Confirm the final files, agreed price, and delivery channel before releasing. Once
        delivered, the client receives the artwork bundle and an invoice link.
      </Callout>

      <div className="mt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">Loading…</div>
        ) : (
          <JobTable jobs={readyJobs} showActions defaultView="grid" emptyLabel="Nothing ready to deliver" />
        )}
      </div>
    </div>
  );
}

function isToday(ts: string | Date): boolean {
  const d = new Date(ts as string);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}
