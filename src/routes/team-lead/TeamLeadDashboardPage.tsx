import { useSessionUser } from '@modules/auth/stores/auth-store';
import {
  GreetingHero,
  StatGrid,
  Panel,
  SectionHeader,
  JOBS,
  jobImage,
  type Job,
} from '@modules/shared-ui';

export function TeamLeadDashboardPage() {
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? 'Ankit';

  const unassigned = JOBS.filter(
    (j) => j.stage === 'quote' && j.status === 'Quote Approved' && !j.assignedTo,
  );
  const allUnassigned = unassigned.length > 0 ? unassigned : JOBS.filter((j) => !j.assignedTo).slice(0, 3);
  const inProgress = JOBS.filter((j) => j.stage === 'junior' || j.stage === 'senior');
  const inQc = JOBS.filter((j) => j.stage === 'qc');

  return (
    <div className="page">
      <GreetingHero
        title={`Good ${getGreeting()}, ${firstName}`}
        subtitle="Assign approved jobs to the right designer or digitizor, watch the team's load, and unblock at-risk work."
      />

      <StatGrid
        stats={[
          {
            accent: 'crimson',
            label: 'Unassigned',
            value: allUnassigned.length,
            delta: allUnassigned.length ? 'Action required' : 'All assigned',
            deltaDirection: allUnassigned.length ? 'down' : 'up',
          },
          { accent: 'blue', label: 'In Progress', value: inProgress.length },
          { accent: 'purple', label: 'Senior Review', value: JOBS.filter((j) => j.stage === 'senior').length },
          { accent: 'green', label: 'Completed (wk.)', value: 2 },
        ]}
      />

      <div className="kanban">
        <KanbanColumn title="Unassigned" color="var(--color-crimson)" jobs={allUnassigned} />
        <KanbanColumn title="In Progress" color="var(--color-amber)" jobs={inProgress.slice(0, 5)} />
        <KanbanColumn title="In QC" color="var(--color-teal)" jobs={inQc} />
      </div>

      <div className="mt-6">
        <SectionHeader title="Recent Activity" />
        <Panel>
          <ul className="text-[12.5px] space-y-2 text-text-muted">
            <li>• Kavya Reddy submitted <span className="text-text font-semibold">J-2025-0036</span> for senior review.</li>
            <li>• Arjun Patel assigned to <span className="text-text font-semibold">J-2025-0046</span>.</li>
            <li>• QC approved <span className="text-text font-semibold">J-2025-0043</span> — ready to deliver.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  color,
  jobs,
}: {
  title: string;
  color: string;
  jobs: Job[];
}) {
  return (
    <div className="k-col">
      <div className="k-col-header">
        <div className="k-col-title">
          <span className="status-dot" style={{ background: color }} aria-hidden />
          <span>{title}</span>
        </div>
        <span className="k-count">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <div className="text-[11.5px] text-text-faint italic py-4 text-center">No jobs here.</div>
      ) : (
        jobs.map((j) => (
          <div key={j.id} className="k-item">
            <img
              src={jobImage(j, 0, 120, 120)}
              alt=""
              className="k-item-thumb"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
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
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
