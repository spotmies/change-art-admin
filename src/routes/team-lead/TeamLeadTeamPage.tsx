import { GreetingHero, Panel, StatGrid, TEAM, type TeamMember } from '@modules/shared-ui';

const ROLE_ORDER: Array<{ role: TeamMember['role']; title: string }> = [
  { role: 'senior_designer', title: 'Senior Designers' },
  { role: 'jr_designer', title: 'Junior Designers' },
  { role: 'digitator', title: 'Digitizors' },
  { role: 'sewout', title: 'Sewout' },
];

export function TeamLeadTeamPage() {
  const stats = {
    onShift: TEAM.filter((m) => m.status !== 'offline').length,
    atCapacity: TEAM.filter((m) => m.status === 'busy').length,
    idle: TEAM.filter((m) => m.status === 'available' && m.jobs === 0).length,
    avgLoad: (TEAM.reduce((s, m) => s + m.jobs, 0) / Math.max(1, TEAM.length)).toFixed(1),
  };

  return (
    <div className="page">
      <GreetingHero
        title="Team Overview"
        subtitle="Live capacity board — load per designer, today's throughput, and skill coverage."
      />

      <StatGrid
        stats={[
          { accent: 'green', label: 'On Shift', value: stats.onShift },
          { accent: 'amber', label: 'At Capacity', value: stats.atCapacity },
          { accent: 'blue', label: 'Idle', value: stats.idle },
          { accent: 'purple', label: 'Avg. Load (jobs)', value: stats.avgLoad },
        ]}
      />

      {ROLE_ORDER.map(({ role, title }) => {
        const members = TEAM.filter((m) => m.role === role);
        if (!members.length) return null;
        return (
          <Panel key={role} title={title}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => (
                <article key={m.id} className="user-card">
                  <div className={`user-av ${avatarColor(m.role)}`}>{m.initials}</div>
                  <div className="user-info">
                    <div className="user-name">{m.name}</div>
                    <div className="user-role-txt flex items-center gap-1.5">
                      <span className={`status-dot ${m.status}`} aria-hidden />
                      {statusLabel(m.status)}
                    </div>
                  </div>
                  <div className="user-stat" aria-label={`${m.jobs} active jobs`}>
                    {m.jobs}
                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-text-faint">
                      jobs
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function statusLabel(s: TeamMember['status']): string {
  switch (s) {
    case 'available':
      return 'Available';
    case 'busy':
      return 'Busy';
    case 'in_progress':
      return 'In Progress';
    default:
      return 'Offline';
  }
}

function avatarColor(role: TeamMember['role']): string {
  switch (role) {
    case 'senior_designer':
      return 'purple';
    case 'jr_designer':
      return 'blue';
    case 'digitator':
      return 'teal';
    case 'sewout':
      return 'amber';
    case 'qc':
      return 'green';
    default:
      return '';
  }
}
