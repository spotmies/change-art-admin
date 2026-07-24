import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { Send, Play } from 'lucide-react';
import {
  Callout,
  GreetingHero,
  JobTable,
  StatGrid,
  ProducerSubmitModal,
  type Job,
} from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { getAllowedFormats } from '@lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * Real Sewout workspace — ChangeArt-New-PRD.md §2.7, §5.7. Jobs are
 * auto-scoped server-side to the logged-in Sewout user.
 */
export function SewoutDashboardPage() {
  const navigate = useNavigate();
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? '';

  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  const pending = jobs.filter((j) => j.rawStatus === 'SUBMITTED_TO_SEWOUT');
  const inProgress = jobs.filter((j) => j.rawStatus === 'SEWOUT_IN_PROGRESS');
  const submittedQc = jobs.filter((j) => j.rawStatus === 'SUBMITTED_TO_QC' || j.rawStatus === 'QC_REVIEW');

  return (
    <div className="page">
      <GreetingHero
        title={`Hi ${firstName || 'there'}`}
        subtitle="Sewout queue. Run stitch files on the machine, log the stitch count, and forward to QC."
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'Pending Sewout', value: pending.length },
          { accent: 'amber', label: 'On Machine Now', value: inProgress.length },
          { accent: 'purple', label: 'Submitted to QC', value: submittedQc.length },
        ]}
      />

      <Callout tone="info">
        Stitch count is mandatory before submitting to QC — the backend rejects a submission
        without it.
      </Callout>

      <div className="mt-3">
        <JobTable
          jobs={pending.concat(inProgress)}
          defaultView="grid"
          onOpen={(j) => navigate(`/sewout/job/${j.uuid}`)}
          renderActions={(j) => <SewoutActions job={j} />}
          emptyLabel={isLoading ? 'Loading…' : 'Nothing on the queue.'}
        />
      </div>
    </div>
  );
}

function SewoutActions({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [showSubmit, setShowSubmit] = useState(false);
  const [pending, setPending] = useState(false);

  const handleAccept = async () => {
    if (!job.uuid || job.version == null) return;
    setPending(true);
    try {
      await adminService.transitionJob(job.uuid, 'sewout_accept', job.version);
      toast.success('Accepted — job moved to Sewout In Progress.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async (_uploadedFileIds: string[], stitchCount?: number) => {
    if (!job.uuid || job.version == null) return;
    await adminService.transitionJobWithStitchCount(job.uuid, 'sewout_submit', job.version, stitchCount);
    toast.success('Submitted to QC.');
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
  };

  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      {job.rawStatus === 'SUBMITTED_TO_SEWOUT' ? (
        <button type="button" className="btn btn-crimson" disabled={pending} onClick={handleAccept}>
          <Play className="w-3.5 h-3.5" aria-hidden />
          Accept
        </button>
      ) : (
        <button type="button" className="btn btn-crimson" onClick={() => setShowSubmit(true)}>
          <Send className="w-3.5 h-3.5" aria-hidden />
          To QC
        </button>
      )}
      {showSubmit && job.uuid ? (
        <ProducerSubmitModal
          jobUuid={job.uuid}
          jobLabel={job.id}
          title="Submit Sewout to QC"
          confirmLabel="Submit to QC"
          requireStitchCount
          allowedFormats={getAllowedFormats(job)}
          onClose={() => setShowSubmit(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
