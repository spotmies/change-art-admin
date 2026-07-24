import { GreetingHero, Panel, SectionHeader, StatGrid } from '@modules/shared-ui';
import { useStaffDirectory } from '@modules/team-lead/hooks/use-staff-directory';
import { usePerformanceReport } from '@modules/admin-panel/hooks/use-analytics-reports';
import { UserRole, UserSubType } from '@contracts';
import type { StaffDirectoryEntry } from '@modules/team-lead/services/staff-directory.service';

function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

const ROLE_GROUPS: { label: string; match: (e: StaffDirectoryEntry) => boolean }[] = [
  { label: 'Senior Designers', match: (e) => e.user.role === UserRole.DESIGNER && e.user.sub_type === UserSubType.SENIOR },
  { label: 'Junior Designers', match: (e) => e.user.role === UserRole.DESIGNER && e.user.sub_type === UserSubType.JUNIOR },
  { label: 'Senior Digitators', match: (e) => e.user.role === UserRole.DIGITATOR && e.user.sub_type === UserSubType.SENIOR },
  { label: 'Junior Digitators', match: (e) => e.user.role === UserRole.DIGITATOR && e.user.sub_type === UserSubType.JUNIOR },
  { label: 'Sewout', match: (e) => e.user.role === UserRole.SEWOUT },
];

/**
 * Real Team Overview — live capacity board sourced from the same Staff
 * Directory aggregation Team Lead/CS use to assign (§1.10), not a separate
 * mock dataset. Historical turnaround/reject-rate reporting is out of scope
 * for this pass — this shows current load, same as the page's own subtitle.
 */
export function TeamLeadTeamPage() {
  const { data: staff, isLoading } = useStaffDirectory();
  const { data: performance, isLoading: performanceLoading } = usePerformanceReport();
  const entries = staff ?? [];

  const onShift = entries.length;
  const atCapacity = entries.filter((e) => e.availability === 'OVERLOADED').length;
  const idle = entries.filter((e) => e.availability === 'FREE').length;
  const avgLoad = entries.length
    ? (entries.reduce((s, e) => s + e.active_job_count, 0) / entries.length).toFixed(1)
    : '0.0';

  return (
    <div className="page">
      <GreetingHero
        title="Team Overview"
        subtitle="Live capacity board — load per producer, sourced from the Staff Directory."
      />

      <StatGrid
        stats={[
          { accent: 'green', label: 'On Roster', value: onShift },
          { accent: 'amber', label: 'Overloaded', value: atCapacity },
          { accent: 'blue', label: 'Free', value: idle },
          { accent: 'purple', label: 'Avg. Load (jobs)', value: avgLoad },
        ]}
      />

      {isLoading ? (
        <div className="text-[12.5px] text-text-muted mt-3">Loading…</div>
      ) : (
        ROLE_GROUPS.map(({ label, match }) => {
          const members = entries.filter(match);
          if (!members.length) return null;
          return (
            <Panel key={label} title={label}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map((m) => (
                  <article key={m.user.id} className="user-card">
                    <div className={`user-av ${avatarColor(m.availability)}`}>
                      {initials(m.user.name)}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{m.user.name}</div>
                      <div className="user-role-txt flex items-center gap-1.5">
                        <span className={`status-dot ${statusDot(m.availability)}`} aria-hidden />
                        {availabilityLabel(m.availability)}
                      </div>
                    </div>
                    <div className="user-stat" aria-label={`${m.active_job_count} of ${m.capacity} active jobs`}>
                      {m.active_job_count}/{m.capacity}
                      <span className="block text-[9.5px] font-bold uppercase tracking-wider text-text-faint">
                        jobs
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          );
        })
      )}

      <div className="mt-6">
        <SectionHeader title="Reporting — all-time performance" />
        <Panel>
          {performanceLoading ? (
            <div className="text-[12.5px] text-text-muted">Loading…</div>
          ) : !performance || performance.length === 0 ? (
            <div className="text-[12.5px] text-text-faint italic">No performance data yet.</div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12.5px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left font-semibold uppercase tracking-wide text-[10px] text-text-faint py-2 px-3 border-b border-border">Staff</th>
                    <th className="text-right font-semibold uppercase tracking-wide text-[10px] text-text-faint py-2 px-3 border-b border-border">Completed</th>
                    <th className="text-right font-semibold uppercase tracking-wide text-[10px] text-text-faint py-2 px-3 border-b border-border">Avg. Turnaround</th>
                    <th className="text-right font-semibold uppercase tracking-wide text-[10px] text-text-faint py-2 px-3 border-b border-border">QC Reject Rate</th>
                    <th className="text-right font-semibold uppercase tracking-wide text-[10px] text-text-faint py-2 px-3 border-b border-border">Team Lead Reject Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance
                    .filter((p) => p.role !== UserRole.CS && p.role !== UserRole.ADMIN && p.role !== UserRole.TEAM_LEAD && p.role !== UserRole.QC)
                    .map((p, i) => (
                      <tr key={p.user_id} className={i % 2 === 1 ? 'bg-black/[0.015] dark:bg-white/[0.02]' : undefined}>
                        <td className="py-2.5 px-3 font-semibold text-text-main border-b border-border/60 truncate max-w-[220px]">{p.name}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-b border-border/60">{p.completed}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-text-muted border-b border-border/60">{p.avg_turnaround_hours != null ? `${p.avg_turnaround_hours}h` : '—'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-text-muted border-b border-border/60">{pct(p.qc_rejection_rate)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-text-muted border-b border-border/60">{pct(p.team_lead_rejection_rate)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function availabilityLabel(a: StaffDirectoryEntry['availability']): string {
  switch (a) {
    case 'FREE': return 'Free';
    case 'BUSY': return 'Busy';
    case 'OVERLOADED': return 'Overloaded';
  }
}

function statusDot(a: StaffDirectoryEntry['availability']): string {
  switch (a) {
    case 'FREE': return 'available';
    case 'BUSY': return 'in_progress';
    case 'OVERLOADED': return 'busy';
  }
}

function avatarColor(a: StaffDirectoryEntry['availability']): string {
  switch (a) {
    case 'FREE': return 'blue';
    case 'BUSY': return 'teal';
    case 'OVERLOADED': return 'amber';
  }
}
