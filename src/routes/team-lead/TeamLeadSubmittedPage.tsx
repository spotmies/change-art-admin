import { GreetingHero, JobTable, SectionHeader, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';

/**
 * Real "everything currently moving through the team" view for Team Lead —
 * ChangeArt-New-PRD.md §5.3. Complements the Assignment Queue (unassigned)
 * and Review Queue (needs my decision) with a broader in-flight snapshot.
 */
export function TeamLeadSubmittedPage() {
  const { jobs: inProduction } = useAdminJobViews({ statuses: 'ASSIGNED,IN_PROGRESS', per_page: 100 });
  const { jobs: awaitingReview } = useAdminJobViews({ statuses: 'SUBMITTED_TO_TEAM_LEAD,TEAM_LEAD_REVIEW', per_page: 100 });
  const { jobs: inSewout } = useAdminJobViews({ statuses: 'SUBMITTED_TO_SEWOUT,SEWOUT_IN_PROGRESS', per_page: 100 });
  const { jobs: inQc } = useAdminJobViews({ statuses: 'SUBMITTED_TO_QC,QC_REVIEW', per_page: 100 });

  return (
    <div className="page">
      <GreetingHero
        title="Submitted Tasks"
        subtitle="Every work item currently moving through the team — current owner, stage, and ETA."
      />

      <StatGrid
        stats={[
          { accent: 'amber', label: 'In Production', value: inProduction.length },
          { accent: 'crimson', label: 'Awaiting My Review', value: awaitingReview.length },
          { accent: 'teal', label: 'In Sewout', value: inSewout.length },
          { accent: 'purple', label: 'In QC', value: inQc.length },
        ]}
      />

      <SectionHeader title="Junior — Submitted for my review" />
      <JobTable jobs={awaitingReview} defaultView="table" emptyLabel="Nothing awaiting review." />

      <div className="mt-6">
        <SectionHeader title="In Production" />
        <JobTable jobs={inProduction} defaultView="table" emptyLabel="Nothing in production." />
      </div>

      <div className="mt-6">
        <SectionHeader title="Sewout + QC" />
        <JobTable jobs={inSewout.concat(inQc)} defaultView="table" emptyLabel="Nothing downstream yet." />
      </div>
    </div>
  );
}
