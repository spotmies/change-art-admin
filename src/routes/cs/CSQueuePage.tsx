import { useMemo, useState } from 'react';
import { GreetingHero, JobTable, Pills, type PillItem } from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;

export function CSQueuePage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [filter, setFilter] = useState('all');

  const artworkJobs = useMemo(() => allData.filter((j) => j.order === 'Artwork'), [allData]);
  const inQuote = useMemo(() => artworkJobs.filter((j) => j.stage === 'quote'), [artworkJobs]);
  const inProd  = useMemo(() => artworkJobs.filter((j) => j.stage === 'junior' || j.stage === 'senior'), [artworkJobs]);
  const inQc    = useMemo(() => artworkJobs.filter((j) => j.stage === 'qc'), [artworkJobs]);
  const amend   = useMemo(() => artworkJobs.filter((j) => j.project === 'Amend'), [artworkJobs]);

  const pills: PillItem[] = [
    { id: 'all',           label: 'All',           count: artworkJobs.length },
    { id: 'Quote',         label: 'Quote',         count: inQuote.length     },
    { id: 'In Production', label: 'In Production', count: inProd.length      },
    { id: 'In QC',         label: 'In QC',         count: inQc.length        },
    { id: 'Amend',         label: 'Amend',         count: amend.length       },
  ];

  const filtered = useMemo(() => {
    if (filter === 'all')   return artworkJobs;
    if (filter === 'Amend') return amend;
    if (filter === 'Quote') return inQuote;
    return artworkJobs.filter((j) => j.status === filter);
  }, [filter, artworkJobs, amend, inQuote]);

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Artwork Order Queue" subtitle="Live production queue for artwork orders." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Artwork Order Queue"
        subtitle="Live production queue for artwork orders. Filter by stage to focus your attention."
      />
      <Pills items={pills} activeId={filter} onSelect={setFilter} />
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">Loading queue…</div>
      ) : (
        <JobTable jobs={filtered} showActions defaultView="grid" />
      )}
    </div>
  );
}
