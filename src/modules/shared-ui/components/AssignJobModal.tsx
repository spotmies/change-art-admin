import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Users, AlertCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { UserRole, UserSubType, type IUser } from '@contracts';
import { useStaffDirectory } from '@modules/team-lead/hooks/use-staff-directory';
import type { StaffDirectoryEntry, StaffJobBrief } from '@modules/team-lead/services/staff-directory.service';
import { useAssignJob } from '@modules/admin-panel/hooks/use-assignments';
import type { Job } from '../mocks/jobs';

const AVAILABILITY_LABEL: Record<StaffDirectoryEntry['availability'], { label: string; accent: string }> = {
  FREE: { label: 'Free', accent: 'green' },
  BUSY: { label: 'Busy', accent: 'amber' },
  OVERLOADED: { label: 'Overloaded', accent: 'red' },
};

interface AssignJobModalProps {
  job: Job | null;
  onClose: () => void;
  /** Called after a successful assignment, e.g. so the caller can close
   *  the job-detail modal that opened this one. */
  onAssigned?: () => void;
}

/**
 * Member-picker modal — groups every active internal staff member by role
 * (and sub-type for designers/digitators), lets the user radio-select one,
 * and posts `/api/v1/assignments`. Mirrors the layout of the v3 prototype's
 * `openAssignModal()` JS function.
 */
export function AssignJobModal({ job, onClose, onAssigned }: AssignJobModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isIn, setIsIn] = useState(false);
  // Which staff member's ongoing-projects panel is expanded — click (or hover
  // via onMouseEnter below) to preview their current load before assigning.
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Fetch internal staff directory showing workloads.
  const { data, isLoading, isError } = useStaffDirectory();
  const assignMutation = useAssignJob();

  useEffect(() => {
    if (job) {
      setSelectedUserId(null);
      setNotes('');
      const raf = requestAnimationFrame(() => setIsIn(true));
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [job]);

  useEffect(() => {
    if (!job) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !assignMutation.isPending) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job, assignMutation.isPending]);

  // Build role groups in the same display order as the v3 prototype.
  const groups = useMemo(() => {
    const rows = data ?? [];
    const sortByName = (a: StaffDirectoryEntry, b: StaffDirectoryEntry) => a.user.name.localeCompare(b.user.name);
    const filter = (predicate: (u: IUser) => boolean) =>
      rows.filter((entry) => entry.user.is_active && predicate(entry.user)).sort(sortByName);
    return [
      { label: 'Team Lead',        staff: filter((u) => u.role === UserRole.TEAM_LEAD) },
      { label: 'Senior Designer',  staff: filter((u) => u.role === UserRole.DESIGNER && u.sub_type === UserSubType.SENIOR) },
      { label: 'Junior Designer',  staff: filter((u) => u.role === UserRole.DESIGNER && u.sub_type === UserSubType.JUNIOR) },
      { label: 'Digitizor',        staff: filter((u) => u.role === UserRole.DIGITATOR) },
      { label: 'Sewout',           staff: filter((u) => u.role === UserRole.SEWOUT) },
      { label: 'QC Reviewer',      staff: filter((u) => u.role === UserRole.QC) },
      { label: 'Client Servicing', staff: filter((u) => u.role === UserRole.CS) },
      { label: 'Admin',            staff: filter((u) => u.role === UserRole.ADMIN) },
    ].filter((g) => g.staff.length > 0);
  }, [data]);

  if (!job) return null;

  const handleClose = () => {
    setIsIn(false);
    setTimeout(() => onClose(), 200);
  };

  const handleConfirm = () => {
    if (!selectedUserId) return;
    if (!job.uuid) {
      // requireUuid pattern matches JobDetailModal — backend needs the UUID.
      return;
    }
    assignMutation.mutate(
      {
        job_card_id: job.uuid,
        assigned_to: selectedUserId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          handleClose();
          onAssigned?.();
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      style={{
        background: isIn ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0)',
        backdropFilter: isIn ? 'blur(5px)' : 'blur(0)',
        WebkitBackdropFilter: isIn ? 'blur(5px)' : 'blur(0)',
        transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !assignMutation.isPending) handleClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Assign job ${job.id}`}
        className="relative w-full max-w-[640px] max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
          transform: isIn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          opacity: isIn ? 1 : 0,
          transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #E8EDF5' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-2 mb-1.5"
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 700, color: '#B22234', letterSpacing: '0.04em' }}
              >
                <span>{job.id}</span>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <span>Assign Job</span>
              </div>
              <h2 className="text-[18px] font-extrabold leading-tight line-clamp-2 break-words" style={{ color: '#0D1B2A' }}>
                {job.design}
              </h2>
              <div className="text-[12px] mt-1" style={{ color: '#64748B' }}>
                Client: <span className="font-semibold" style={{ color: '#0D1B2A' }}>{job.client}</span>
                {' · '}
                <span className="font-semibold" style={{ color: '#0D1B2A' }}>{job.priority}</span>
                {' · '}
                <span className="font-semibold" style={{ color: '#0D1B2A' }}>{job.order}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={assignMutation.isPending}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition"
              style={{
                border: '1px solid #E8EDF5',
                color: '#94A3B8',
                opacity: assignMutation.isPending ? 0.5 : 1,
                cursor: assignMutation.isPending ? 'not-allowed' : 'pointer',
              }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ background: '#fff' }}>

          {/* Info banner */}
          <div
            className="flex items-start gap-2 mb-4"
            style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#3B82F6' }} aria-hidden />
            <span>Select one team member to assign this job. They'll be notified and the job moves to <b style={{ color: '#0D1B2A' }}>Assigned</b>.</span>
          </div>

          {/* Missing UUID guard — surfaces the mock-data caveat. */}
          {!job.uuid ? (
            <div
              className="text-[12px] mb-4"
              style={{ color: '#B45309', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 6, padding: '8px 12px' }}
            >
              This job is missing its backend UUID — assignment can't be sent. Refresh the page and try again.
            </div>
          ) : null}

          {/* Loading state */}
          {isLoading ? (
            <div className="text-center py-8 text-[12.5px]" style={{ color: '#64748B' }}>
              Loading team…
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-[12.5px]" style={{ color: '#DC2626' }}>
              Failed to load team members. Refresh and try again.
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-[12.5px]" style={{ color: '#64748B' }}>
              <Users className="w-6 h-6 mx-auto mb-2" style={{ color: '#CBD5E1' }} />
              No active team members found.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-4">
                <div
                  className="mb-2"
                  style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#94A3B8',
                  }}
                >
                  {g.label}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {g.staff.map((entry) => {
                    const u = entry.user;
                    const checked = selectedUserId === u.id;
                    const initials = (u.name || u.email).split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                    const avail = AVAILABILITY_LABEL[entry.availability];
                    const atRiskCount = entry.jobs.filter((j) => j.at_risk).length;

                    const isExpanded = expandedUserId === u.id;
                    const toggleExpanded = (e: React.MouseEvent) => {
                      // Stop the click from also toggling the radio via the
                      // wrapping <label>'s native label→control forwarding.
                      e.preventDefault();
                      e.stopPropagation();
                      setExpandedUserId(isExpanded ? null : u.id);
                    };

                    return (
                      <div
                        key={u.id}
                        style={{
                          gridColumn: isExpanded ? '1 / -1' : undefined,
                          border: `1px solid ${checked ? 'rgba(178,34,52,0.55)' : isExpanded ? '#DCE3EE' : '#E8EDF5'}`,
                          borderRadius: 10,
                          background: checked ? 'rgba(178,34,52,0.04)' : isExpanded ? '#FAFBFD' : '#fff',
                          transition: 'border-color 150ms ease, background 150ms ease',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={() => { if (entry.jobs.length > 0) setExpandedUserId(u.id); }}
                      >
                        <label
                          className="flex items-center gap-2.5 cursor-pointer"
                          style={{ padding: '10px 12px' }}
                        >
                          <input
                            type="radio"
                            name="assign-person"
                            value={u.id}
                            checked={checked}
                            onChange={() => setSelectedUserId(u.id)}
                            style={{ accentColor: '#B22234', flexShrink: 0 }}
                            disabled={assignMutation.isPending}
                          />
                          <div
                            className="flex items-center justify-center shrink-0"
                            style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: 'rgba(178,34,52,0.12)',
                              color: '#B22234', fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                            }}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-[13px] text-[#0D1B2A] truncate">{u.name}</div>
                              <span className={`badge ${avail.accent}`}>{avail.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-[2px] text-[11px]" style={{ color: '#94A3B8' }}>
                              <span>{entry.active_job_count} active job{entry.active_job_count === 1 ? '' : 's'}</span>
                              {atRiskCount > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 font-semibold"
                                  style={{
                                    color: '#B45309',
                                    background: 'rgba(217,119,6,0.1)',
                                    borderRadius: 99,
                                    padding: '1px 6px',
                                  }}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" aria-hidden />
                                  {atRiskCount} at risk
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {entry.jobs.length > 0 ? (
                            <button
                              type="button"
                              onClick={toggleExpanded}
                              aria-label={isExpanded ? 'Hide ongoing projects' : 'Show ongoing projects'}
                              aria-expanded={isExpanded}
                              className="flex-shrink-0 flex items-center justify-center transition"
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                color: isExpanded ? '#B22234' : '#94A3B8',
                                background: isExpanded ? 'rgba(178,34,52,0.08)' : 'transparent',
                              }}
                            >
                              <ChevronDown
                                className="w-3.5 h-3.5"
                                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
                                aria-hidden
                              />
                            </button>
                          ) : null}
                        </label>

                        {isExpanded && entry.jobs.length > 0 ? (
                          <StaffOngoingJobs jobs={entry.jobs} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Optional notes */}
          {groups.length > 0 ? (
            <div className="mt-3">
              <label
                className="block uppercase mb-1.5"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#64748B' }}
              >
                Notes for assignee <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, opacity: 0.7 }}>(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Client wants this prioritised. Use the latest brand kit."
                disabled={assignMutation.isPending}
                style={{
                  width: '100%',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  color: '#0D1B2A',
                  minHeight: 56,
                  resize: 'vertical',
                  outline: 'none',
                  background: '#fff',
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-3.5"
          style={{ borderTop: '1px solid #E8EDF5', background: '#FAFBFD' }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
            onClick={handleClose}
            disabled={assignMutation.isPending}
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-crimson"
            style={{ fontSize: 12, padding: '7px 14px', gap: 6, opacity: !selectedUserId || !job.uuid || assignMutation.isPending ? 0.55 : 1, cursor: !selectedUserId || !job.uuid || assignMutation.isPending ? 'not-allowed' : 'pointer' }}
            onClick={handleConfirm}
            disabled={!selectedUserId || !job.uuid || assignMutation.isPending}
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden />
            {assignMutation.isPending ? 'Assigning…' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Ongoing-projects preview shown under a staff row on hover/click, so the
 *  assigner can see exactly what this person is already carrying — and its
 *  ETA — before piling on more work. */
function StaffOngoingJobs({ jobs }: { jobs: StaffJobBrief[] }) {
  return (
    <div style={{ borderTop: '1px solid #E8EDF5', padding: '10px 12px 12px' }}>
      <div
        className="mb-1.5"
        style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8' }}
      >
        Ongoing projects
      </div>
      <div className="flex flex-col gap-1.5">
        {jobs.map((j) => (
          <div
            key={j.job_card_id}
            className="flex items-center justify-between gap-3"
            style={{ background: '#fff', border: '1px solid #EDF1F7', borderRadius: 8, padding: '8px 10px' }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-semibold" style={{ color: '#B22234', fontSize: 10.5 }}>
                  {j.reference_number}
                </span>
                <span
                  className="font-semibold"
                  style={{ fontSize: 9.5, color: '#475569', background: '#F1F5F9', borderRadius: 4, padding: '1px 6px' }}
                >
                  {humanizeStatus(j.status)}
                </span>
                {j.at_risk ? (
                  <span
                    className="inline-flex items-center gap-1 font-semibold"
                    style={{ fontSize: 9.5, color: '#B91C1C', background: 'rgba(220,38,38,0.1)', borderRadius: 4, padding: '1px 6px' }}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" aria-hidden />
                    At risk
                  </span>
                ) : null}
              </div>
              <div className="truncate mt-1" style={{ fontSize: 12, fontWeight: 600, color: '#0D1B2A' }}>
                {j.design_name}
                {j.client_name ? <span style={{ fontWeight: 500, color: '#94A3B8' }}> · {j.client_name}</span> : null}
              </div>
            </div>
            <div
              className="shrink-0 text-right"
              style={{ fontSize: 11, fontWeight: 600, color: j.eta_hours != null ? '#0D1B2A' : '#94A3B8' }}
            >
              {j.eta_hours != null ? `ETA ${j.eta_hours}h` : 'No ETA'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
