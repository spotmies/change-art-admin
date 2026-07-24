import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { Send, RotateCcw } from 'lucide-react';
import {
  GreetingHero,
  JobTable,
  Panel,
  SectionHeader,
  StatGrid,
  ProducerSubmitModal,
  type Job,
} from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { RejectionFeedback } from '@modules/admin-panel/components/RejectionFeedback';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { getAllowedFormats } from '@lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const ACTIVE_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS']);
const AWAITING_STATUSES = new Set(['SUBMITTED_TO_SENIOR', 'SENIOR_REVIEW', 'SUBMITTED_TO_SEWOUT', 'SEWOUT_IN_PROGRESS', 'SUBMITTED_TO_QC', 'QC_REVIEW']);
const REWORK_STATUSES = new Set(['SENIOR_REJECTED', 'QC_REJECTED']);

/**
 * Real Digitator (Junior + Senior) workspace — same shape as Designer
 * (ChangeArt-New-PRD.md §2.6), plus Digitizing-specific fields and the
 * sewout-vs-QC routing split on submit.
 */
export function DigitatorDashboardPage() {
  const navigate = useNavigate();
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? '';
  const isSenior = user?.sub_type === 'SENIOR';

  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  const active = jobs.filter((j) => j.rawStatus && ACTIVE_STATUSES.has(j.rawStatus));
  const awaiting = jobs.filter((j) => j.rawStatus && AWAITING_STATUSES.has(j.rawStatus));
  const rework = jobs.filter((j) => j.rawStatus && REWORK_STATUSES.has(j.rawStatus));

  return (
    <div className="page">
      <GreetingHero
        title={`Hi ${firstName || 'there'}`}
        subtitle={
          isSenior
            ? 'Your active digitising tasks — execute directly or dispatch to Sewout/QC.'
            : 'Cut your assigned stitch files and submit to your Team Lead for review.'
        }
      />

      <StatGrid
        stats={[
          { accent: 'crimson', label: 'My Active', value: active.length },
          { accent: 'purple', label: 'Awaiting Review', value: awaiting.length },
          { accent: 'amber', label: 'Needs Rework', value: rework.length },
        ]}
      />

      <div className="two-col">
        <div>
          <SectionHeader title="My Active Tasks" />
          <JobTable
            jobs={active}
            defaultView="grid"
            onOpen={(j) => navigate(`/digitator/job/${j.uuid}`)}
            renderActions={(j) => <ActiveActions job={j} />}
            emptyLabel={isLoading ? 'Loading…' : 'No digitising tasks right now.'}
          />

          {rework.length > 0 ? (
            <div className="mt-5">
              <SectionHeader title="Rework Queue" />
              <JobTable
                jobs={rework}
                defaultView="grid"
                onOpen={(j) => navigate(`/digitator/job/${j.uuid}`)}
                renderActions={(j) => <ReworkActions job={j} />}
                emptyLabel="Nothing needs rework."
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Awaiting Review">
            {awaiting.length === 0 ? (
              <div className="text-[12px] text-text-faint italic">Nothing in flight.</div>
            ) : (
              <ul className="text-[12px] text-text-muted space-y-2">
                {awaiting.map((j) => (
                  <li key={j.uuid}>
                    <span className="font-mono text-text">{j.id}</span> — {j.status}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ActiveActions({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [showSubmit, setShowSubmit] = useState(false);
  const isSewout = job.order === 'Digitizing + Sewout';
  const acceptedRef = useRef(false);

  // Team Lead's manual assignment IS the decision — a digitizor never gets a
  // choice to accept or decline. New assignments already land in IN_PROGRESS
  // (assignments.service.ts), but any job still sitting in ASSIGNED (e.g. from
  // before this change) is silently carried forward here with no button/toast.
  useEffect(() => {
    if (job.rawStatus === 'ASSIGNED' && job.uuid && job.version != null && !acceptedRef.current) {
      acceptedRef.current = true;
      adminService.transitionJob(job.uuid, 'accept', job.version)
        .then(() => void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() }))
        .catch(() => { acceptedRef.current = false; });
    }
  }, [job.rawStatus, job.uuid, job.version, queryClient]);

  const isJunior = job.subType === 'Junior';

  const handleSubmit = async (uploadedFileIds: string[]) => {
    if (!job.uuid || job.version == null) return;
    void uploadedFileIds;
    // Junior Digitator's work always goes to Senior review first (per the
    // Digitizing workflow — Team Lead review is Artwork/Print-only). Only a
    // Senior working solo (no Junior in the loop) routes straight out.
    const action = isJunior ? 'submit_to_senior' : isSewout ? 'senior_direct_to_sewout' : 'senior_direct_submit';
    await adminService.transitionJob(job.uuid, action, job.version);
    toast.success(isJunior ? 'Submitted to Senior Digitator for review.' : isSewout ? 'Routed to Sewout.' : 'Submitted to QC.');
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
  };

  return (
    <div className="job-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn btn-crimson" onClick={() => setShowSubmit(true)}>
        <Send className="w-3.5 h-3.5" aria-hidden />
        {isJunior ? 'Submit to Senior' : isSewout ? 'To Sewout' : 'To QC'}
      </button>
      {showSubmit && job.uuid ? (
        <ProducerSubmitModal
          jobUuid={job.uuid}
          jobLabel={job.id}
          title="Submit Completed Digitizing File"
          confirmLabel="Submit"
          allowedFormats={getAllowedFormats(job)}
          onClose={() => setShowSubmit(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

function ReworkActions({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const handleStartRework = async () => {
    if (!job.uuid || job.version == null) return;
    setPending(true);
    try {
      const action = job.rawStatus === 'QC_REJECTED' ? 'rework_after_qc' : 'rework';
      await adminService.transitionJob(job.uuid, action, job.version);
      toast.success('Moved back to In Progress — revise and resubmit.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <RejectionFeedback jobId={job.uuid} />
      <div className="job-actions">
        <button type="button" className="btn btn-outline" disabled={pending} onClick={handleStartRework}>
          <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          Start Rework
        </button>
      </div>
    </div>
  );
}
