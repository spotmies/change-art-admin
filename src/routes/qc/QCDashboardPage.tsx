import { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  Callout,
  GreetingHero,
  JobTable,
  StatGrid,
  JobDetailModal,
  type Job,
} from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const REJECTION_REASONS = [
  { value: 'COLOUR', label: 'Colour' },
  { value: 'ALIGNMENT', label: 'Alignment' },
  { value: 'RESOLUTION', label: 'Resolution' },
  { value: 'STITCH_ERROR', label: 'Stitch Error' },
  { value: 'INCORRECT_BRIEF', label: 'Incorrect Brief' },
  { value: 'FILE_FORMAT', label: 'File Format' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Real QC Review Queue — ChangeArt-New-PRD.md §2.8, §5.8. QC is a pool role
 * (any QC reviewer can pick up any submitted job), so this queries by status
 * rather than server-side assignee scoping.
 */
export function QCDashboardPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { jobs, isLoading } = useAdminJobViews({ statuses: 'SUBMITTED_TO_QC,QC_REVIEW', per_page: 100 });

  return (
    <div className="page">
      <GreetingHero
        title="Review Queue"
        subtitle="Submissions awaiting your QC decision. Approve to release, reject to return with a structured reason."
      />

      <StatGrid stats={[{ accent: 'crimson', label: 'Pending Review', value: jobs.length }]} />

      <Callout tone="info">
        Compare original brief + files against the completed work. Rejections capture a structured
        reason so the producer can self-serve the fix.
      </Callout>

      <div className="mt-3">
        <JobTable
          jobs={jobs}
          defaultView="grid"
          onOpen={setSelectedJob}
          renderActions={(j) => <QCActions job={j} />}
          emptyLabel={isLoading ? 'Loading…' : 'Queue is empty.'}
        />
      </div>

      {selectedJob ? (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      ) : null}
    </div>
  );
}

function QCActions({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('OTHER');
  const [feedback, setFeedback] = useState('');

  async function ensureOpened(): Promise<number | undefined> {
    if (!job.uuid || job.version == null) return undefined;
    if (job.rawStatus === 'SUBMITTED_TO_QC') {
      const updated = await adminService.transitionJob(job.uuid, 'qc_open', job.version);
      return updated.version;
    }
    return job.version;
  }

  const handleApprove = async () => {
    if (!job.uuid || job.version == null) return;
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      await adminService.transitionJob(job.uuid, 'qc_approve', nextVersion);
      toast.success('Approved — job locked and routed to CS for delivery.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  const handleReject = async () => {
    if (!job.uuid || job.version == null || !feedback.trim()) return;
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      await adminService.qcReject(job.uuid, nextVersion, reason, feedback.trim());
      toast.success('Rejected — returned with feedback.');
      setShowReject(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn btn-red" disabled={pending} onClick={() => setShowReject(true)}>
        <X className="w-3.5 h-3.5" aria-hidden />
        Reject
      </button>
      <button type="button" className="btn btn-green" disabled={pending} onClick={handleApprove}>
        <Check className="w-3.5 h-3.5" aria-hidden />
        Approve
      </button>

      {showReject ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/55"
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setShowReject(false); }}
          role="presentation"
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-2xl bg-white p-5">
            <h3 className="text-[15px] font-bold text-text mb-3">Reject {job.id}</h3>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1.5">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] mb-3"
              disabled={pending}
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1.5">
              Feedback (required)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
              placeholder="Describe what needs to change…"
              disabled={pending}
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" className="btn btn-outline" onClick={() => setShowReject(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="btn btn-red" onClick={handleReject} disabled={pending || !feedback.trim()}>
                {pending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
