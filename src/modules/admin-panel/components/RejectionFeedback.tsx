import { useJobReviews } from '../hooks/use-reviews';

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
 * Shows the most recent rejection's reason + feedback for a job — used in
 * producer Rework Queues so a rejection isn't just a silent status flip
 * (ChangeArt-New-PRD.md §5.4 #4 / §5.5 #4).
 */
export function RejectionFeedback({ jobId }: { jobId: string | undefined }) {
  const { data: reviews, isLoading } = useJobReviews(jobId);
  const latestRejection = reviews?.find((r) => r.decision === 'REJECTED');

  if (isLoading) {
    return <div className="text-[11px] text-text-faint italic mb-1.5">Loading feedback…</div>;
  }
  if (!latestRejection) return null;

  return (
    <div className="mb-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-[11px]">
      {latestRejection.rejection_reason ? (
        <div className="font-semibold text-red-700">
          {REASON_LABEL[latestRejection.rejection_reason] ?? latestRejection.rejection_reason}
        </div>
      ) : null}
      {latestRejection.feedback ? <div className="text-red-800 mt-0.5">{latestRejection.feedback}</div> : null}
    </div>
  );
}
