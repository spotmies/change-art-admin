import { useState } from 'react';
import { Send } from 'lucide-react';
import {
  GreetingHero,
  JobTable,
  StatGrid,
  Callout,
  AssignJobModal,
  Pagination,
  type Job,
} from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { StaffDirectoryPanel } from '@modules/team-lead/components/StaffDirectoryPanel';

/**
 * Assignment Queue — now fetching all jobs in the production pipeline (not dispatched)
 * per recent requirements, allowing Team Leads to manage the full active board.
 */
export function TeamLeadQueuePage() {
  const [page, setPage] = useState(1);
  const perPage = 25;
  const { jobs: items, total, isLoading } = useAdminJobViews({ statuses: 'CS_APPROVED,ASSIGNED,IN_PROGRESS,SUBMITTED_TO_TEAM_LEAD,TEAM_LEAD_REVIEW,TEAM_LEAD_REJECTED,QC_REJECTED,MODIFICATION_REQUESTED,SUBMITTED_TO_SEWOUT,SEWOUT_IN_PROGRESS,SUBMITTED_TO_QC,QC_REVIEW', page, per_page: perPage });
  const [assignJob, setAssignJob] = useState<Job | null>(null);

  return (
    <div className="page">
      <GreetingHero
        title="Assignment Queue"
        subtitle="All active jobs waiting to be assigned or currently in production."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Active Jobs', value: total },
          {
            accent: 'amber',
            label: 'Urgent (This Page)',
            value: items.filter((j) => j.priority !== 'Normal').length,
          },
        ]}
      />

      <Callout tone="info">
        Match SLA, complexity, and current load to the right designer. Check the Staff Directory
        below before assigning.
      </Callout>

      <div className="mt-3">
        <JobTable
          jobs={items}
          defaultView="grid"
          renderActions={(j) => <AssignButton job={j} onClick={() => setAssignJob(j)} />}
          emptyLabel={isLoading ? 'Loading…' : 'Queue is clear.'}
        />
        <Pagination
          page={page}
          totalPages={Math.ceil(total / perPage)}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
        />
      </div>

      <div className="mt-6">
        <StaffDirectoryPanel />
      </div>

      {assignJob ? <AssignJobModal job={assignJob} onClose={() => setAssignJob(null)} /> : null}
    </div>
  );
}

function AssignButton({ job, onClick }: { job: Job; onClick: () => void }) {
  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-crimson"
        aria-label={`Assign ${job.id}`}
        onClick={onClick}
      >
        <Send aria-hidden className="w-3.5 h-3.5" />
        Assign
      </button>
    </div>
  );
}
