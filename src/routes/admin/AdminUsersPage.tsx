import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { GreetingHero, Pagination, Panel, StatGrid } from '@modules/shared-ui';
import { UserRole, UserSubType } from '@contracts';
import type { IUser } from '@contracts';
import { useAdminUsers, useDeleteUser } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { ApiClientError } from '@lib/api-client';
import { UserFormModal, type UserModalMode } from '../../modules/admin-panel/components/UserFormModal';

const PER_PAGE = 20;
const FETCH_LIMIT = 100;

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: UserRole.CS, label: 'Client Servicing' },
  { value: UserRole.TEAM_LEAD, label: 'Team Lead' },
  { value: UserRole.DESIGNER, label: 'Designer' },
  { value: UserRole.DIGITATOR, label: 'Digitizor' },
  { value: UserRole.SEWOUT, label: 'Sewout' },
  { value: UserRole.QC, label: 'QC Reviewer' },
  { value: UserRole.ADMIN, label: 'Admin' },
];

function roleLabel(role: UserRole): string {
  return ROLE_FILTERS.find((r) => r.value === role)?.label ?? role;
}

function subTypeBadge(sub: UserSubType | null) {
  if (!sub) return <span className="text-text-faint">—</span>;
  const label = sub.charAt(0) + sub.slice(1).toLowerCase();
  return <span className={`badge ${sub === UserSubType.SENIOR ? 'crimson' : 'blue'}`}>{label}</span>;
}

function nameInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState<{ mode: UserModalMode; user: IUser | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IUser | null>(null);

  const { data, isLoading, isError } = useAdminUsers({ per_page: FETCH_LIMIT });
  const deleteMutation = useDeleteUser();

  const allUsers = useMemo<IUser[]>(() => data?.items ?? [], [data]);

  const total        = allUsers.length;
  const activeCount  = allUsers.filter((u) => u.is_active).length;
  const inactiveCount = total - activeCount;
  const adminCount   = allUsers.filter((u) => u.role === UserRole.ADMIN).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      if (term && !(u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)))
        return false;
      return true;
    });
  }, [allUsers, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageUsers = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page],
  );

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="page">
      <GreetingHero
        title="User Management"
        subtitle="Create accounts, assign roles, gate permissions, and audit access changes."
      />

      <StatGrid
        stats={[
          { accent: 'blue',    label: 'Total Users', value: isLoading ? '…' : total },
          { accent: 'green',   label: 'Active',      value: isLoading ? '…' : activeCount },
          { accent: 'amber',   label: 'Inactive',    value: isLoading ? '…' : inactiveCount },
          { accent: 'crimson', label: 'Admins',      value: isLoading ? '…' : adminCount },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
            aria-hidden
          />
          <input
            className="fi"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <select
          className="fi"
          style={{ width: 'auto', minWidth: 150 }}
          value={roleFilter}
          onChange={(e) => resetToFirstPage(setRoleFilter)(e.target.value)}
          aria-label="Filter by role"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          className="fi"
          style={{ width: 'auto', minWidth: 130 }}
          value={statusFilter}
          onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="button"
          className="btn btn-crimson"
          onClick={() => setModal({ mode: 'create', user: null })}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
          New User
        </button>
      </div>

      <Panel title={`All Users${filtered.length ? ` (${filtered.length})` : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">Loading users…</div>
        ) : isError ? (
          <div className="flex items-center justify-center py-12 text-[var(--crimson)] text-sm">
            Failed to load users. Please refresh and try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-faint text-sm">No users match your filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Sub-Type</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((u: IUser) => (
                    <tr
                      key={u.id}
                      className="cursor-pointer"
                      onClick={() => setModal({ mode: 'view', user: u })}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))' }}
                            aria-hidden
                          >
                            {nameInitials(u.name)}
                          </span>
                          <span className="font-semibold">{u.name}</span>
                        </div>
                      </td>
                      <td>{roleLabel(u.role)}</td>
                      <td>{subTypeBadge((u.sub_type as UserSubType | null) ?? null)}</td>
                      <td className="text-text-muted">{u.email}</td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-md"
                          style={u.is_active
                            ? { background: 'rgba(34,197,94,0.12)', color: 'var(--color-green)', border: '1px solid rgba(34,197,94,0.25)' }
                            : { background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)', border: '1px solid rgba(100,116,139,0.25)' }
                          }
                        >
                          <span className={`status-dot ${u.is_active ? 'available' : 'offline'}`} aria-hidden />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-outline"
                            aria-label={`Edit ${u.name}`}
                            onClick={() => setModal({ mode: 'edit', user: u })}
                          >
                            <Pencil aria-hidden className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            aria-label={`Delete ${u.name}`}
                            style={{ color: 'var(--color-crimson)', borderColor: 'rgba(196,30,58,0.35)' }}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 aria-hidden className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </Panel>

      {modal ? (
        <UserFormModal mode={modal.mode} user={modal.user} onClose={() => setModal(null)} />
      ) : null}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleteMutation.isPending) setDeleteTarget(null); }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete user"
            className="w-full max-w-[420px] rounded-2xl overflow-hidden"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-bright)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}
          >
            <div className="px-5 py-4 font-semibold" style={{ color: 'var(--text-main)', borderBottom: '1px solid var(--glass-border)' }}>
              Delete user?
            </div>
            <div className="px-5 py-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              <div className="mb-2">
                <span className="font-bold" style={{ color: 'var(--text-main)' }}>{deleteTarget.name}</span>
                <span className="ml-1">({deleteTarget.email})</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>The user will be permanently removed.</li>
                <li>All their sessions will be invalidated immediately.</li>
                <li>This action cannot be undone.</li>
              </ul>
            </div>
            {deleteMutation.isError && (
              <div className="px-5 pb-3 text-[11.5px]" style={{ color: 'var(--color-crimson, #c41e3a)' }}>
                {deleteMutation.error instanceof ApiClientError
                  ? deleteMutation.error.toUserMessage()
                  : 'Failed to delete user.'}
                {deleteMutation.error instanceof ApiClientError && deleteMutation.error.code !== 'USER_HAS_HISTORY'
                  ? ' — click Delete User to retry.'
                  : null}
              </div>
            )}
            <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg-light, rgba(15,23,42,0.03))' }}>
              <button
                type="button"
                className="btn btn-outline disabled:opacity-60"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                className="btn btn-crimson disabled:opacity-50"
                onClick={() => {
                  deleteMutation.mutate(deleteTarget.id, {
                    onSuccess: () => {
                      toast.success(`${deleteTarget.name} has been deleted.`);
                      setDeleteTarget(null);
                    },
                  });
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="w-3.5 h-3.5" />
                )}
                {deleteMutation.isPending ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
