import { useState } from 'react';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import {
  GreetingHero,
  StatGrid,
  Panel,
  SectionHeader,
  Pagination,
  JobDetailModal,
  AssignJobModal,
} from '@modules/shared-ui';
import { useAdminJobViews, useAdminJobById } from '@modules/admin-panel/hooks/use-admin-jobs';
import type { Job } from '@modules/shared-ui/mocks/jobs';

/**
 * Real Team Lead landing dashboard — ChangeArt-New-PRD.md §5.3. Kanban
 * columns sourced from real job-cards data (CS_APPROVED = unassigned queue,
 * ASSIGNED/IN_PROGRESS = in production, SUBMITTED_TO_QC/QC_REVIEW = in QC).
 */
export function TeamLeadDashboardPage() {
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? '';

  const [pageUnassigned, setPageUnassigned] = useState(1);
  const [pageInProgress, setPageInProgress] = useState(1);
  const [pageReview, setPageReview] = useState(1);
  const [pageInQc, setPageInQc] = useState(1);
  const perPage = 5;
  
  // Store only the identifier and re-fetch the live copy on open (same pattern
  // as JobTable.tsx) — the kanban's list queries are 30s-stale and don't
  // reflect fields like acknowledgement that can change while the dashboard
  // sits open, which was hiding "Assign Job" for jobs the list snapshot hadn't
  // caught up on yet.
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [assignJob, setAssignJob] = useState<Job | null>(null);

  const { jobs: unassigned, total: unassignedTotal } = useAdminJobViews({ statuses: 'CS_APPROVED', page: pageUnassigned, per_page: perPage });
  const { jobs: inProgress, total: inProgressTotal } = useAdminJobViews({ statuses: 'ASSIGNED,IN_PROGRESS,TEAM_LEAD_REJECTED,QC_REJECTED,MODIFICATION_REQUESTED,SUBMITTED_TO_SEWOUT,SEWOUT_IN_PROGRESS', page: pageInProgress, per_page: perPage });
  const { jobs: reviewJobs, total: reviewTotal } = useAdminJobViews({ statuses: 'SUBMITTED_TO_TEAM_LEAD,TEAM_LEAD_REVIEW', page: pageReview, per_page: perPage });
  const { jobs: inQc, total: inQcTotal } = useAdminJobViews({ statuses: 'SUBMITTED_TO_QC,QC_REVIEW', page: pageInQc, per_page: perPage });

  const listJob = selectedJobId
    ? [...unassigned, ...inProgress, ...reviewJobs, ...inQc].find((j) => (j.uuid ?? j.id) === selectedJobId) ?? null
    : null;
  const { data: detailJob } = useAdminJobById(selectedJobId ?? '');
  const selectedJob = detailJob ?? listJob;

  return (
    <div className="page">
      <GreetingHero
        title={`Good ${getGreeting()}, ${firstName || 'there'}`}
        subtitle="Assign approved jobs to the right designer or digitizor, watch the team's load, and unblock at-risk work."
      />

      <StatGrid
        stats={[
          {
            accent: 'crimson',
            label: 'Unassigned',
            value: unassignedTotal,
            delta: unassignedTotal ? 'Action required' : 'All assigned',
            deltaDirection: unassignedTotal ? 'down' : 'up',
          },
          { accent: 'blue', label: 'In Progress', value: inProgressTotal },
          { accent: 'purple', label: 'Review Needed', value: reviewTotal },
          { accent: 'teal', label: 'In QC', value: inQcTotal },
        ]}
      />

      <div className="kanban">
        <KanbanColumn 
          title="Unassigned" 
          color="var(--color-crimson)" 
          jobs={unassigned} 
          total={unassignedTotal}
          page={pageUnassigned}
          perPage={perPage}
          onPageChange={setPageUnassigned}
          onJobClick={(j) => setSelectedJobId(j.uuid ?? j.id)}
        />
        <KanbanColumn 
          title="In Progress" 
          color="var(--color-amber)" 
          jobs={inProgress} 
          total={inProgressTotal}
          page={pageInProgress}
          perPage={perPage}
          onPageChange={setPageInProgress}
          onJobClick={(j) => setSelectedJobId(j.uuid ?? j.id)}
        />
        <KanbanColumn 
          title="Review Needed" 
          color="#a855f7" 
          jobs={reviewJobs} 
          total={reviewTotal}
          page={pageReview}
          perPage={perPage}
          onPageChange={setPageReview}
          onJobClick={(j) => setSelectedJobId(j.uuid ?? j.id)}
        />
        <KanbanColumn 
          title="In QC" 
          color="var(--color-teal)" 
          jobs={inQc} 
          total={inQcTotal}
          page={pageInQc}
          perPage={perPage}
          onPageChange={setPageInQc}
          onJobClick={(j) => setSelectedJobId(j.uuid ?? j.id)}
        />
      </div>

      <div className="mt-6">
        <SectionHeader title="Team Directory" />
        <Panel>
          <p className="text-[12.5px] text-text-muted">
            See who's Free/Busy/Overloaded and assign or reassign from the Team Overview and
            Assignment Queue pages.
          </p>
        </Panel>
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onAssign={(j) => { setSelectedJobId(null); setAssignJob(j); }}
        />
      )}

      {assignJob && (
        <AssignJobModal
          job={assignJob}
          onClose={() => setAssignJob(null)}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  title,
  color,
  jobs,
  total,
  page,
  perPage,
  onPageChange,
  onJobClick,
}: {
  title: string;
  color: string;
  jobs: Job[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onJobClick: (job: Job) => void;
}) {
  return (
    <div className="k-col flex flex-col h-full">
      <div className="k-col-header shrink-0">
        <div className="k-col-title">
          <span className="status-dot" style={{ background: color }} aria-hidden />
          <span>{title}</span>
        </div>
        <span className="k-count">{total}</span>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {jobs.length === 0 ? (
          <div className="text-[11.5px] text-text-faint italic py-4 text-center">No jobs here.</div>
        ) : (
          jobs.map((j) => (
            <div 
              key={j.uuid ?? j.id} 
              className="k-item cursor-pointer hover:border-white/10 transition-colors"
              onClick={() => onJobClick(j)}
            >
              <div className="k-item-body">
                <div className="k-item-id">{j.id}</div>
                <div className="k-item-title">{j.design}</div>
                <div className="k-item-meta">
                  <span>{j.client}</span>
                  <span>·</span>
                  {j.etaHours != null && <span>{j.etaHours}h</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > perPage && (
        <div className="shrink-0 pt-2 border-t border-white/5 mt-auto">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / perPage)}
            total={total}
            perPage={perPage}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
