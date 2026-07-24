import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { GreetingHero, Panel } from '@modules/shared-ui';
import { useAdminJobById, useAdminJobFiles, useAdminJobImageUrls, isAdminViewableImage } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { toastApiError } from '@lib/toast-error';
import { queryKeys } from '@lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { FileCategory } from '@contracts';
import { FileGrid } from './FileGrid';

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
 * QC Review Workspace — ChangeArt-New-PRD.md §5.8 #2: Original Files + brief
 * side-by-side with Completed Files (and stitch count, if a sewout job).
 * Approve or reject with a structured reason + written feedback.
 */
export function QCReviewWorkspacePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('OTHER');
  const [feedback, setFeedback] = useState('');

  const { data: job, isLoading } = useAdminJobById(jobId ?? '');
  const { data: files } = useAdminJobFiles(job?.uuid);

  const originalFiles = useMemo(() => (files ?? []).filter((f) => f.file_category === FileCategory.ORIGINAL), [files]);
  const completedFiles = useMemo(
    () => (files ?? []).filter((f) => f.file_category === FileCategory.COMPLETED).sort((a, b) => b.version_number - a.version_number),
    [files],
  );
  const originalImageFiles = useMemo(() => originalFiles.filter(isAdminViewableImage), [originalFiles]);
  const completedImageFiles = useMemo(() => completedFiles.filter(isAdminViewableImage), [completedFiles]);
  const { data: originalUrls } = useAdminJobImageUrls(job?.uuid, originalImageFiles);
  const { data: completedUrls } = useAdminJobImageUrls(job?.uuid, completedImageFiles);

  if (isLoading || !job || !job.uuid) {
    return (
      <div className="page">
        <GreetingHero title="Review Workspace" subtitle="Loading…" />
      </div>
    );
  }

  async function ensureOpened(): Promise<number | undefined> {
    if (!job!.uuid || job!.version == null) return undefined;
    if (job!.rawStatus === 'SUBMITTED_TO_QC') {
      const updated = await adminService.transitionJob(job!.uuid, 'qc_open', job!.version);
      return updated.version;
    }
    return job!.version;
  }

  const handleApprove = async () => {
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      await adminService.transitionJob(job.uuid!, 'qc_approve', nextVersion);
      toast.success('Approved — job locked and routed to CS for delivery.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      navigate(-1);
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) return;
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      await adminService.qcReject(job.uuid!, nextVersion, reason, feedback.trim());
      toast.success('Rejected — returned with feedback.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      navigate(-1);
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="page">
      <button type="button" className="btn btn-outline mb-3" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
        Back
      </button>

      <GreetingHero title={job.design} subtitle={`${job.ref} · ${job.order}`} />

      <div className="two-col">
        <div className="flex flex-col gap-3">
          <Panel title="Brief">
            <dl className="text-[12.5px] space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Priority</dt>
                <dd className="font-semibold">{job.priority}</dd>
              </div>
              {job.stitchCount != null ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-text-muted">Stitch Count</dt>
                  <dd className="font-semibold">{job.stitchCount.toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
            {job.summary || job.notes ? (
              <div className="mt-3 pt-3 border-t border-border text-[12px] text-text-muted whitespace-pre-wrap">
                {job.summary || job.notes}
              </div>
            ) : null}
          </Panel>

          <div className="job-actions">
            <button type="button" className="btn btn-red" disabled={pending} onClick={() => setShowReject(true)}>
              <X className="w-3.5 h-3.5" aria-hidden />
              Reject
            </button>
            <button type="button" className="btn btn-green" disabled={pending} onClick={handleApprove}>
              <Check className="w-3.5 h-3.5" aria-hidden />
              Approve
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Original Files">
            <FileGrid
              imageFiles={originalImageFiles}
              imageUrls={originalUrls ?? []}
              otherFiles={originalFiles.filter((f) => !isAdminViewableImage(f))}
            />
          </Panel>

          <Panel title="Completed Files">
            <FileGrid
              imageFiles={completedImageFiles}
              imageUrls={completedUrls ?? []}
              otherFiles={completedFiles.filter((f) => !isAdminViewableImage(f))}
            />
          </Panel>
        </div>
      </div>

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
