import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Users, AlertCircle } from 'lucide-react';
import { UserRole, UserSubType, type IUser } from '@contracts';
import { useAdminUsers } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useAssignJob } from '@modules/admin-panel/hooks/use-assignments';
import type { Job } from '../mocks/jobs';

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

  // Fetch internal staff once — exclude clients server-side.
  // Backend caps per_page at 100 (see listUsersQuerySchema). For a small
  // tenant 100 covers the entire internal staff list; if a deployment ever
  // grows past 100 active users this should switch to a paginator.
  const { data, isLoading, isError } = useAdminUsers({ is_active: true, per_page: 100 });
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
    const rows = data?.items ?? [];
    const sortByName = (a: IUser, b: IUser) => a.name.localeCompare(b.name);
    const filter = (predicate: (u: IUser) => boolean) =>
      rows.filter((u) => u.is_active && predicate(u)).sort(sortByName);
    return [
      { label: 'Team Lead',        users: filter((u) => u.role === UserRole.TEAM_LEAD) },
      { label: 'Senior Designer',  users: filter((u) => u.role === UserRole.DESIGNER && u.sub_type === UserSubType.SENIOR) },
      { label: 'Junior Designer',  users: filter((u) => u.role === UserRole.DESIGNER && u.sub_type === UserSubType.JUNIOR) },
      { label: 'Digitizor',        users: filter((u) => u.role === UserRole.DIGITATOR) },
      { label: 'Sewout',           users: filter((u) => u.role === UserRole.SEWOUT) },
      { label: 'QC Reviewer',      users: filter((u) => u.role === UserRole.QC) },
      { label: 'Client Servicing', users: filter((u) => u.role === UserRole.CS) },
      { label: 'Admin',            users: filter((u) => u.role === UserRole.ADMIN) },
    ].filter((g) => g.users.length > 0);
  }, [data?.items]);

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
              <h2 className="text-[18px] font-extrabold leading-tight" style={{ color: '#0D1B2A' }}>
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
                  {g.users.map((u) => {
                    const checked = selectedUserId === u.id;
                    const initials = (u.name || u.email).split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2.5 cursor-pointer transition"
                        style={{
                          padding: '10px 12px',
                          border: `1px solid ${checked ? 'rgba(178,34,52,0.55)' : '#E8EDF5'}`,
                          background: checked ? 'rgba(178,34,52,0.04)' : '#fff',
                          borderRadius: 8,
                        }}
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
                            border: '1px solid rgba(178,34,52,0.2)',
                            fontSize: 10, fontWeight: 700, color: '#B22234',
                          }}
                        >
                          {initials || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[12.5px] truncate" style={{ color: '#0D1B2A' }}>
                            {u.name || u.email}
                          </div>
                          <div className="text-[10.5px]" style={{ color: '#64748B' }}>
                            {u.sub_type ? `${u.sub_type[0]}${u.sub_type.slice(1).toLowerCase()} · ` : ''}{u.email}
                          </div>
                        </div>
                      </label>
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
