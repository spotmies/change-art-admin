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
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * Senior Digitator review queue — jobs a Junior Digitator has submitted on a
 * Digitizing (or Digitizing + Sewout) order, awaiting Senior accept/reject.
 * Mirrors Team Lead's Junior Review queue exactly, but for the Digitizing
 * track, where Senior Digitator — not Team Lead — is the reviewer.
 *
 * The backend keeps a two-step SUBMITTED_TO_SENIOR → SENIOR_REVIEW shape
 * (mirroring Team Lead/QC's own open→decide pattern), but the reviewer
 * experiences it as one click — Approve/Reject chains `senior_open_review`
 * then the decision transition.
 */
export function SeniorReviewPage() {
  const viewer = useSessionUser();
  const isSenior = viewer?.sub_type === 'SENIOR';
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { jobs: submissions, isLoading } = useAdminJobViews({
    statuses: 'SUBMITTED_TO_SENIOR,SENIOR_REVIEW',
    per_page: 100,
  });

  if (!isSenior) {
    return (
      <div className="page">
        <GreetingHero
          title="Senior Review"
          subtitle="Only Senior Digitators review Junior submissions on this queue."
        />
        <Callout tone="info">
          This queue is for Senior Digitators. Junior submissions you complete will be reviewed by a Senior Digitator on your team.
        </Callout>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Junior Submissions"
        subtitle="Verify and approve junior digitizing work before it forwards to QC (or Sewout)."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Awaiting Review', value: submissions.length },
        ]}
      />

      <Callout tone="info">
        Approve forwards the submission to QC (or Sewout, if this order requires it). Reject
        returns it to the junior with written feedback.
      </Callout>

      <div className="mt-3">
        <JobTable
          jobs={submissions}
          defaultView="grid"
          renderActions={(j) => <ReviewActions job={j} />}
          onOpen={setSelectedJob}
          emptyLabel={isLoading ? 'Loading…' : 'Nothing awaiting review.'}
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

function ReviewActions({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  /** Opens the review if needed and returns the authoritative version to transition from next. */
  async function ensureOpened(): Promise<number | undefined> {
    if (!job.uuid || job.version == null) return undefined;
    if (job.rawStatus === 'SUBMITTED_TO_SENIOR') {
      const updated = await adminService.transitionJob(job.uuid, 'senior_open_review', job.version);
      return updated.version;
    }
    return job.version;
  }

  async function handleApprove() {
    if (!job.uuid || job.version == null) return;
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      // Digitizing + Sewout orders route to Sewout instead of straight to QC.
      const action = job.order === 'Digitizing + Sewout' ? 'senior_approve_to_sewout' : 'senior_approve';
      await adminService.transitionJob(job.uuid, action, nextVersion);
      toast.success(action === 'senior_approve_to_sewout' ? 'Approved — routed to Sewout.' : 'Approved — forwarded to QC.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  }

  async function handleReject() {
    if (!job.uuid || job.version == null) return;
    const feedback = window.prompt('Feedback for the junior (required):');
    if (!feedback?.trim()) return;
    setPending(true);
    try {
      const nextVersion = await ensureOpened();
      if (nextVersion == null) return;
      await adminService.transitionJob(job.uuid, 'senior_reject', nextVersion, undefined, feedback.trim());
      toast.success('Returned to junior with feedback.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-red"
        aria-label={`Reject ${job.id}`}
        disabled={pending}
        onClick={handleReject}
      >
        <X aria-hidden className="w-3.5 h-3.5" />
        Reject
      </button>
      <button
        type="button"
        className="btn btn-green"
        aria-label={`Approve ${job.id}`}
        disabled={pending}
        onClick={handleApprove}
      >
        <Check aria-hidden className="w-3.5 h-3.5" />
        Approve
      </button>
    </div>
  );
}
