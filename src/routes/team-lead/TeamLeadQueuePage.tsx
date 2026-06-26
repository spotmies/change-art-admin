import { Send } from 'lucide-react';
import {
  GreetingHero,
  JobTable,
  StatGrid,
  Callout,
  JOBS,
  type Job,
} from '@modules/shared-ui';

export function TeamLeadQueuePage() {
  // Pretend approved-quotes-without-assignee are the assignment queue.
  const queue = JOBS.filter((j) => j.stage === 'quote' && j.status === 'Quote Approved');
  // Fallback to "no assignee yet" if none — keeps the page meaningful with mock data.
  const items = queue.length ? queue : JOBS.filter((j) => !j.assignedTo).slice(0, 3);

  return (
    <div className="page">
      <GreetingHero
        title="Assignment Queue"
        subtitle="Approved jobs waiting to be assigned to a designer or digitizor."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Unassigned', value: items.length },
          {
            accent: 'amber',
            label: 'Urgent',
            value: items.filter((j) => j.priority !== 'Normal').length,
          },
          { accent: 'blue', label: 'Assigned Today', value: 0 },
          { accent: 'purple', label: 'Avg. Wait', value: '2.1h' },
        ]}
      />

      <Callout tone="info">
        Match SLA, complexity, and current load to the right designer. Use the Team Overview to
        check capacity before assigning.
      </Callout>

      <div className="mt-3">
        <JobTable
          jobs={items}
          defaultView="grid"
          renderActions={(j) => <AssignButton job={j} />}
          emptyLabel="Queue is clear."
        />
      </div>
    </div>
  );
}

function AssignButton({ job }: { job: Job }) {
  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-crimson"
        aria-label={`Assign ${job.id}`}
        onClick={() => alert(`Assign flow for ${job.id} — wire to /api/jobs/${job.id}/assign`)}
      >
        <Send aria-hidden className="w-3.5 h-3.5" />
        Assign
      </button>
    </div>
  );
}
