import { useMemo } from 'react';
import {
  BarChart,
  GreetingHero,
  MiniBars,
  Panel,
  StatGrid,
} from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useReviewHistory } from '@modules/admin-panel/hooks/use-review-history';
import { useQcRejectionReport } from '@modules/admin-panel/hooks/use-analytics-reports';

const REASON_LABEL: Record<string, string> = {
  COLOUR: 'Colour',
  ALIGNMENT: 'Alignment',
  RESOLUTION: 'Resolution',
  STITCH_ERROR: 'Stitch Error',
  INCORRECT_BRIEF: 'Brief Mismatch',
  FILE_FORMAT: 'File Format',
  OTHER: 'Other',
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function QCStatsPage() {
  const { total: pendingTotal } = useAdminJobViews({ statuses: 'SUBMITTED_TO_QC,QC_REVIEW', per_page: 1 });
  const { data } = useReviewHistory({ review_type: 'QC_REVIEW', per_page: 200 });
  const rows = data?.items ?? [];

  const approved = rows.filter((r) => r.decision === 'APPROVED').length;
  const rejected = rows.filter((r) => r.decision === 'REJECTED').length;

  // All-time rejection-reason breakdown (not capped to the last 200 decisions
  // like the rows above) — backed by the analytics performance rollup.
  const { data: rejectionReport } = useQcRejectionReport();
  const reasonBreakdown = useMemo(() => {
    return (rejectionReport ?? [])
      .filter((r) => r.reason)
      .map((r) => ({ label: REASON_LABEL[r.reason as string] ?? r.reason ?? 'Other', value: r.count }));
  }, [rejectionReport]);

  const last7Days = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const counts = buckets.map((day) => {
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      return rows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return r.decision === 'REJECTED' && t >= day.getTime() && t < next.getTime();
      }).length;
    });
    const max = Math.max(1, ...counts);
    return buckets.map((day, i) => ({
      label: DAY_LABELS[day.getDay()] ?? '',
      value: counts[i] ?? 0,
      height: Math.round(((counts[i] ?? 0) / max) * 70) || 4,
      highlight: i === 6,
    }));
  }, [rows]);

  return (
    <div className="page">
      <GreetingHero
        title="QC Dashboard"
        subtitle="Operational view — rejection reasons are all-time; approvals/rejections and the 7-day trend are from the last 200 recorded decisions."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Pending Review', value: pendingTotal },
          { accent: 'green', label: 'Approved', value: approved },
          { accent: 'amber', label: 'Rejected', value: rejected },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Rejection Reasons">
          {reasonBreakdown.length === 0 ? (
            <div className="text-[12px] text-text-faint italic">No rejections recorded yet.</div>
          ) : (
            <MiniBars items={reasonBreakdown} />
          )}
        </Panel>

        <Panel title="7-Day Rejection Count">
          <BarChart items={last7Days} />
        </Panel>
      </div>
    </div>
  );
}
