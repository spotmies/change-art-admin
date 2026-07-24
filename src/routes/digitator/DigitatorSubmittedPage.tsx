import { GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';

const AWAITING_STATUSES = new Set(['SUBMITTED_TO_TEAM_LEAD', 'TEAM_LEAD_REVIEW', 'SUBMITTED_TO_SEWOUT', 'SEWOUT_IN_PROGRESS', 'SUBMITTED_TO_QC', 'QC_REVIEW']);

export function DigitatorSubmittedPage() {
  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  const awaiting = jobs.filter((j) => j.rawStatus && AWAITING_STATUSES.has(j.rawStatus));
  const inSewout = awaiting.filter((j) => j.stage === 'sewout');
  const inQc = awaiting.filter((j) => j.stage === 'qc');

  return (
    <div className="page">
      <GreetingHero
        title="Submitted Digitizing"
        subtitle="Files you've cut — under Team Lead review, sewout, or in QC."
      />

      <StatGrid
        stats={[
          { accent: 'amber', label: 'In Sewout', value: inSewout.length },
          { accent: 'purple', label: 'In QC', value: inQc.length },
        ]}
      />

      <JobTable jobs={awaiting} defaultView="grid" emptyLabel={isLoading ? 'Loading…' : 'Nothing submitted yet.'} />
    </div>
  );
}
