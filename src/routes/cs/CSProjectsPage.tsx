import { useMemo } from 'react';
import { GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;

export function CSProjectsPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });

  const open  = useMemo(() => allData.filter((j) => j.stage !== 'delivered'), [allData]);
  const ready = useMemo(() => allData.filter((j) => j.status === 'Ready to Deliver'), [allData]);
  const amend = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);

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
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">Loading projects…</div>
      ) : (
        <JobTable jobs={allData} showActions defaultView="grid" />
      )}
    </div>
  );
}
