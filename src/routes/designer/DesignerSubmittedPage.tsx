import { Callout, GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';

const AWAITING_STATUSES = new Set(['SUBMITTED_TO_TEAM_LEAD', 'TEAM_LEAD_REVIEW', 'SUBMITTED_TO_QC', 'QC_REVIEW', 'SUBMITTED_TO_SEWOUT', 'SEWOUT_IN_PROGRESS']);

export function DesignerSubmittedPage() {
  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  const awaiting = jobs.filter((j) => j.rawStatus && AWAITING_STATUSES.has(j.rawStatus));

  return (
    <div className="page">
      <GreetingHero
        title="My Submitted Tasks"
        subtitle="Work you've submitted — current review stage and downstream status."
      />

      <StatGrid
        stats={[
          { accent: 'purple', label: 'In Review', value: awaiting.length },
        ]}
      />

      <Callout tone="info">
        Team Lead or QC may return your submission with feedback. Returned work lands back in your
        Rework Queue on the main dashboard.
      </Callout>

      <div className="mt-3">
        <JobTable jobs={awaiting} defaultView="grid" emptyLabel={isLoading ? 'Loading…' : 'Nothing in flight.'} />
      </div>
    </div>
  );
}
