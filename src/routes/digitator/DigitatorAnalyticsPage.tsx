import { useMemo } from 'react';
import { GreetingHero, MiniBars, Panel, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useMyPerformance } from '@modules/admin-panel/hooks/use-analytics-reports';

const ACTIVE_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS']);
const AWAITING_STATUSES = new Set(['SUBMITTED_TO_TEAM_LEAD', 'TEAM_LEAD_REVIEW', 'SUBMITTED_TO_SEWOUT', 'SEWOUT_IN_PROGRESS', 'SUBMITTED_TO_QC', 'QC_REVIEW']);
const REWORK_STATUSES = new Set(['TEAM_LEAD_REJECTED', 'QC_REJECTED']);

function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

/**
 * Real "My Performance" — same shape as Designer's (§2.6), plus historical
 * stats from the analytics performance rollup.
 */
export function DigitatorAnalyticsPage() {
  const { jobs } = useAdminJobViews({ per_page: 100 });
  const { data: perf, isLoading: perfLoading } = useMyPerformance();

  const active = jobs.filter((j) => j.rawStatus && ACTIVE_STATUSES.has(j.rawStatus));
  const awaiting = jobs.filter((j) => j.rawStatus && AWAITING_STATUSES.has(j.rawStatus));
  const rework = jobs.filter((j) => j.rawStatus && REWORK_STATUSES.has(j.rawStatus));

  const byOrderType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) counts.set(j.order, (counts.get(j.order) ?? 0) + 1);
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  }, [jobs]);

  return (
    <div className="page">
      <GreetingHero
        title="My Performance"
        subtitle="Historical throughput plus your current in-flight pipeline."
      />

      <StatGrid
        stats={[
          { accent: 'green', label: 'Completed (all-time)', value: perfLoading ? '…' : (perf?.completed ?? 0) },
          { accent: 'blue', label: 'Avg. Turnaround', value: perf?.avg_turnaround_hours != null ? `${perf.avg_turnaround_hours}h` : '—' },
          { accent: 'crimson', label: 'QC Rejection Rate', value: pct(perf?.qc_rejection_rate ?? null) },
          { accent: 'amber', label: 'Team Lead Rejection Rate', value: pct(perf?.team_lead_rejection_rate ?? null) },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <Panel title="Currently Active" className="lg:col-span-1">
          <div className="text-[12.5px] text-text-muted space-y-1.5">
            <div className="flex justify-between"><span>Active</span><span className="font-semibold text-text">{active.length}</span></div>
            <div className="flex justify-between"><span>Awaiting Review</span><span className="font-semibold text-text">{awaiting.length}</span></div>
            <div className="flex justify-between"><span>Needs Rework</span><span className="font-semibold text-text">{rework.length}</span></div>
          </div>
        </Panel>

        <Panel title="Files by Order Type" className="lg:col-span-2">
          {byOrderType.length === 0 ? (
            <div className="text-[12px] text-text-faint italic">No files in flight.</div>
          ) : (
            <MiniBars items={byOrderType} />
          )}
        </Panel>
      </div>
    </div>
  );
}
