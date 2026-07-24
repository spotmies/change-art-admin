import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { GreetingHero, StatGrid } from '@modules/shared-ui';
import { formatDateTime } from '@lib/utils';
import { useReviewHistory } from '@modules/admin-panel/hooks/use-review-history';

const REASON_LABEL: Record<string, string> = {
  COLOUR: 'Colour',
  ALIGNMENT: 'Alignment',
  RESOLUTION: 'Resolution',
  STITCH_ERROR: 'Stitch Error',
  INCORRECT_BRIEF: 'Incorrect Brief',
  FILE_FORMAT: 'File Format',
  OTHER: 'Other',
};

/**
 * Full historical QC audit log — every decision ever recorded (not just jobs
 * currently sitting at a QC-decided status), via GET /api/v1/reviews/history.
 * ChangeArt-New-PRD.md §5.8 #3.
 */
export function QCHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviewHistory({ review_type: 'QC_REVIEW', page, per_page: 25 });

  const rows = data?.items ?? [];
  const approvedCount = rows.filter((r) => r.decision === 'APPROVED').length;
  const rejectedCount = rows.filter((r) => r.decision === 'REJECTED').length;

  return (
    <div className="page">
      <GreetingHero
        title="QC History"
        subtitle="Searchable log of every QC decision — approvals, rejections, and the reason attached."
      />

      <StatGrid
        stats={[
          { accent: 'blue', label: 'Total Decisions', value: data?.meta.total ?? 0 },
          { accent: 'green', label: 'Approved (this page)', value: approvedCount },
          { accent: 'crimson', label: 'Rejected (this page)', value: rejectedCount },
        ]}
      />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-text-muted border-b border-border">
              <th className="py-2 pr-3">Job</th>
              <th className="py-2 pr-3">Decision</th>
              <th className="py-2 pr-3">Reason</th>
              <th className="py-2 pr-3">Feedback</th>
              <th className="py-2 pr-3">Reviewer</th>
              <th className="py-2 pr-3">When</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6 text-center text-text-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-text-faint italic">No history yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <div className="font-mono text-[11px] text-crimson">{r.job_reference_number}</div>
                    <div className="truncate max-w-[200px]">{r.job_design_name}</div>
                  </td>
                  <td className="py-2 pr-3">
                    {r.decision === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                        <Check className="w-3.5 h-3.5" aria-hidden /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                        <X className="w-3.5 h-3.5" aria-hidden /> Rejected
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.rejection_reason ? REASON_LABEL[r.rejection_reason] ?? r.rejection_reason : '—'}</td>
                  <td className="py-2 pr-3 max-w-[240px] truncate">{r.feedback ?? '—'}</td>
                  <td className="py-2 pr-3">{r.reviewer_name ?? '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.meta.total_pages > 1 ? (
        <div className="flex items-center justify-end gap-2 mt-3">
          <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-[12px] text-text-muted">Page {page} of {data.meta.total_pages}</span>
          <button type="button" className="btn btn-outline" disabled={page >= data.meta.total_pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
