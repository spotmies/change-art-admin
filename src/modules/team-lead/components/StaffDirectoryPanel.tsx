import { useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { Panel } from '@modules/shared-ui';
import { useAdminUsers } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useAssignJob } from '@modules/admin-panel/hooks/use-assignments';
import { UserRole, type IUser } from '@contracts';
import { useStaffDirectory } from '../hooks/use-staff-directory';
import type { StaffDirectoryEntry, StaffJobBrief } from '../services/staff-directory.service';

const AVAILABILITY_LABEL: Record<StaffDirectoryEntry['availability'], { label: string; accent: string }> = {
  FREE: { label: 'Free', accent: 'green' },
  BUSY: { label: 'Busy', accent: 'amber' },
  OVERLOADED: { label: 'Overloaded', accent: 'red' },
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  ARTWORK: 'Artwork',
  DIGITIZING: 'Digitizing',
  DIGITIZING_SEWOUT: 'Digitizing + Sewout',
  OTHERS: 'Others',
};

const STAGE_LABEL: Record<string, string> = {
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  SUBMITTED_TO_TEAM_LEAD: 'Submitted to Team Lead',
  TEAM_LEAD_REVIEW: 'Team Lead Review',
  TEAM_LEAD_REJECTED: 'Rework (Team Lead)',
  SUBMITTED_TO_SEWOUT: 'Submitted to Sewout',
  SEWOUT_IN_PROGRESS: 'Sewout In Progress',
  SUBMITTED_TO_QC: 'Submitted to QC',
  QC_REVIEW: 'In QC',
  QC_REJECTED: 'Rework (QC)',
};

/**
 * Team Lead + CS Staff Directory — see ChangeArt-New-PRD.md §1.10. Shows
 * every producer's availability and active job load, with the fixed ETA
 * CS/Admin set upstream at review (not editable here — see §1.11).
 */
export function StaffDirectoryPanel() {
  const { data: staff, isLoading, isError } = useStaffDirectory();

  return (
    <Panel title="Staff Directory">
      {isLoading ? (
        <div className="text-center py-8 text-[12.5px] text-text-muted">Loading staff…</div>
      ) : isError ? (
        <div className="text-center py-8 text-[12.5px] text-red-600">Failed to load staff directory.</div>
      ) : !staff || staff.length === 0 ? (
        <div className="text-center py-8 text-[12.5px] text-text-muted">
          <Users className="w-6 h-6 mx-auto mb-2 opacity-40" aria-hidden />
          No active producers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staff.map((entry) => (
            <StaffCard key={entry.user.id} entry={entry} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function roleLabel(user: IUser): string {
  const roleName = user.role === UserRole.DESIGNER ? 'Designer' : user.role === UserRole.DIGITATOR ? 'Digitator' : 'Sewout';
  if (!user.sub_type) return roleName;
  const sub = user.sub_type[0] + user.sub_type.slice(1).toLowerCase();
  return `${sub} ${roleName}`;
}

function StaffCard({ entry }: { entry: StaffDirectoryEntry }) {
  const { user, availability, active_job_count, capacity, jobs } = entry;
  const avail = AVAILABILITY_LABEL[availability];
  const atRiskCount = jobs.filter((j) => j.at_risk).length;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[13px] truncate">{user.name}</div>
          <div className="text-[11px] text-text-muted">{roleLabel(user)}</div>
        </div>
        <span className={`badge ${avail.accent}`}>{avail.label}</span>
      </div>

      <div className="flex items-center gap-2 mt-2 text-[11px] text-text-muted">
        <span>{active_job_count}/{capacity} active jobs</span>
        {atRiskCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
            <AlertTriangle className="w-3 h-3" aria-hidden />
            {atRiskCount} at risk
          </span>
        ) : null}
      </div>

      {jobs.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {jobs.map((job) => (
            <JobBriefRow key={job.job_card_id} job={job} currentAssigneeId={user.id} />
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-text-faint italic">No active jobs.</div>
      )}
    </div>
  );
}

function JobBriefRow({ job, currentAssigneeId }: { job: StaffJobBrief; currentAssigneeId: string }) {
  const [reassignOpen, setReassignOpen] = useState(false);

  return (
    <div className="rounded border border-border/70 px-2 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-medium">{job.reference_number} · {job.client_name ?? 'Unknown client'}</div>
        {job.at_risk ? <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" aria-hidden /> : null}
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5 text-text-muted">
        <span>{ORDER_TYPE_LABEL[job.order_type] ?? job.order_type} · {STAGE_LABEL[job.status] ?? job.status}</span>
        {job.eta_hours != null ? <span>{job.eta_hours}h</span> : null}
      </div>
      <button
        type="button"
        className="mt-1 text-crimson font-semibold"
        onClick={() => setReassignOpen((v) => !v)}
      >
        Reassign
      </button>
      {reassignOpen ? (
        <ReassignPicker
          jobCardId={job.job_card_id}
          currentAssigneeId={currentAssigneeId}
          onDone={() => setReassignOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ReassignPicker({
  jobCardId,
  currentAssigneeId,
  onDone,
}: {
  jobCardId: string;
  currentAssigneeId: string;
  onDone: () => void;
}) {
  const { data } = useAdminUsers({ is_active: true, per_page: 100 });
  const assignMutation = useAssignJob();

  const candidates = (data?.items ?? []).filter(
    (u) =>
      u.is_active &&
      u.id !== currentAssigneeId &&
      (u.role === UserRole.DESIGNER || u.role === UserRole.DIGITATOR || u.role === UserRole.SEWOUT),
  );

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {candidates.length === 0 ? (
        <span className="text-text-faint italic">No other eligible staff.</span>
      ) : (
        candidates.map((u) => (
          <button
            key={u.id}
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 10.5, padding: '3px 8px' }}
            disabled={assignMutation.isPending}
            onClick={() =>
              assignMutation.mutate(
                { job_card_id: jobCardId, assigned_to: u.id },
                { onSuccess: onDone },
              )
            }
          >
            {u.name}{u.sub_type ? ` (${u.sub_type[0]}${u.sub_type.slice(1).toLowerCase()})` : ''}
          </button>
        ))
      )}
    </div>
  );
}

export type { StaffDirectoryEntry };
