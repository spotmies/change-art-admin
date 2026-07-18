import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, UserX, Eye, EyeOff } from 'lucide-react';
import { ConfirmModal } from '@modules/shared-ui';
import { UserRole, UserSubType } from '@contracts';
import type { IUser } from '@contracts';
import { useCreateUser, useDeactivateUser, useUpdateUser } from '../hooks/use-admin-users';
import { useSessionUser } from '@modules/auth/stores/auth-store';

export type UserModalMode = 'view' | 'edit' | 'create';

interface UserFormModalProps {
  mode: UserModalMode;
  user: IUser | null;
  onClose: () => void;
}

// Internal staff roles — CLIENT is intentionally excluded (clients live in the
// Clients tab, not User Management). ADMIN is commented out: Admin accounts
// are no longer assignable from this dropdown (create or edit) — they can
// only be provisioned directly, not through the User Management UI.
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.CS, label: 'Client Servicing' },
  { value: UserRole.TEAM_LEAD, label: 'Team Lead' },
  { value: UserRole.DESIGNER, label: 'Designer' },
  { value: UserRole.DIGITATOR, label: 'Digitizor' },
  { value: UserRole.SEWOUT, label: 'Sewout' },
  { value: UserRole.QC, label: 'QC Reviewer' },
  // { value: UserRole.ADMIN, label: 'Admin' },
];

// Only these roles carry a Junior / Senior sub-type.
const SUBTYPE_ROLES = new Set<UserRole>([UserRole.DESIGNER, UserRole.DIGITATOR]);

// Mirrors the backend's password policy (change-art-backend/src/modules/auth/password-policy.ts)
// so weak passwords are caught here instead of round-tripping to the server.
const PASSWORD_REQUIREMENTS: { label: string; test: (p: string) => boolean }[] = [
  { label: 'at least 8 characters', test: (p) => p.length >= 8 },
  { label: 'one uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'one lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'one number', test: (p) => /[0-9]/.test(p) },
  { label: 'one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function passwordStrengthError(password: string): string | null {
  const failed = PASSWORD_REQUIREMENTS.filter((r) => !r.test(password));
  if (failed.length === 0) return null;
  return `Password must include ${failed.map((r) => r.label).join(', ')}.`;
}

// Labels for roles that may already exist on a user record even though they
// aren't assignable via ROLE_OPTIONS (e.g. ADMIN).
const NON_ASSIGNABLE_ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [UserRole.ADMIN]: 'Admin',
};

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? NON_ASSIGNABLE_ROLE_LABELS[role] ?? role;
}

function subTypeLabel(sub: UserSubType | null): string {
  if (!sub) return '—';
  return sub.charAt(0) + sub.slice(1).toLowerCase();
}

function nameInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  subType: UserSubType | '';
  isActive: boolean;
}

function initialState(mode: UserModalMode, user: IUser | null): FormState {
  if (mode === 'create' || !user) {
    return { name: '', email: '', password: '', role: UserRole.DESIGNER, subType: '', isActive: true };
  }
  return {
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    subType: (user.sub_type as UserSubType | null) ?? '',
    isActive: user.is_active,
  };
}

export function UserFormModal({ mode, user, onClose }: UserFormModalProps) {
  const [editing, setEditing] = useState(mode !== 'view' && user?.role !== UserRole.ADMIN);
  const [form, setForm] = useState<FormState>(() => initialState(mode, user));
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const sessionUser = useSessionUser();
  const create = useCreateUser();
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();
  const saving = create.isPending || update.isPending;
  const isSelf = !!user && !!sessionUser && user.id === sessionUser.id;

  // Reset the form whenever the modal target changes.
  useEffect(() => {
    setForm(initialState(mode, user));
    setEditing(mode !== 'view' && user?.role !== UserRole.ADMIN);
    setError(null);
    setShowPassword(false);
  }, [mode, user]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmingDeactivate) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, confirmingDeactivate]);

  const isCreate = mode === 'create';
  const showSubType = SUBTYPE_ROLES.has(form.role);
  // Admin accounts cannot be edited from this modal at all — matches the
  // User Management table, which already hides the row-level Edit/Reset/
  // Delete actions for Admin rows.
  const isAdminTarget = !isCreate && user?.role === UserRole.ADMIN;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const viewRows: [string, string][] = useMemo(() => {
    if (!user) return [];
    return [
      ['Full Name', user.name],
      ['Email', user.email],
      ['Role', roleLabel(user.role)],
      ['Sub-Type', subTypeLabel((user.sub_type as UserSubType | null) ?? null)],
      ['Status', user.is_active ? 'Active' : 'Inactive'],
    ];
  }, [user]);

  function handleSave() {
    setError(null);

    if (!form.name.trim()) return setError('Name is required.');
    const subTypeValue: UserSubType | null = showSubType && form.subType ? (form.subType as UserSubType) : null;

    if (isCreate) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return setError('A valid email is required.');
      const passwordError = passwordStrengthError(form.password);
      if (passwordError) return setError(passwordError);
      create.mutate(
        {
          email: form.email.trim().toLowerCase(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
          ...(subTypeValue ? { sub_type: subTypeValue } : {}),
        },
        { onSuccess: onClose },
      );
      return;
    }

    if (!user) return;
    update.mutate(
      {
        id: user.id,
        body: {
          name: form.name.trim(),
          role: form.role,
          sub_type: subTypeValue,
          is_active: form.isActive,
        },
      },
      { onSuccess: onClose },
    );
  }

  function handleDeactivate() {
    if (!user) return;
    deactivate.mutate(user.id, {
      onSuccess: () => {
        setConfirmingDeactivate(false);
        onClose();
      },
      onError: () => setConfirmingDeactivate(false),
    });
  }

  const title = isCreate ? 'New User' : user?.name ?? '';

  const modal = (
    <div
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label={isCreate ? 'Create user' : `User: ${user?.name}`}
    >
      <div className="modal" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="modal-top">
          {!isCreate && user ? (
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))' }}
              aria-hidden
            >
              {nameInitials(user.name)}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title">{title || 'New User'}</div>
            {!isCreate && user ? (
              <div className="modal-tags">
                <span className="badge gray">{roleLabel(user.role)}</span>
                {user.sub_type ? (
                  <span className={`badge ${user.sub_type === UserSubType.SENIOR ? 'crimson' : 'blue'}`}>
                    {subTypeLabel(user.sub_type as UserSubType)}
                  </span>
                ) : null}
                <span className={`badge ${user.is_active ? 'green' : 'gray'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ) : (
              <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Create an internal staff account.
              </div>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {!editing && user ? (
            <>
              <div className="m-sec-title">User Details</div>
              {viewRows.map(([key, val]) => (
                <div key={key} className="f-row">
                  <div className="f-key">{key}</div>
                  <div className="f-val">{val}</div>
                </div>
              ))}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pb-1">
              <div className="col-span-2">
                <label className="fl">Full Name</label>
                <input
                  className="fi"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Priya Sharma"
                />
              </div>

              <div className={isCreate ? '' : 'col-span-2'}>
                <label className="fl">Email</label>
                <input
                  className="fi"
                  type="email"
                  value={form.email}
                  disabled={!isCreate}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="name@changeartwork.com"
                  style={!isCreate ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                />
              </div>

              {isCreate ? (
                <div>
                  <label className="fl">Password</label>
                  <div className="relative">
                    <input
                      className="fi pr-9"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      placeholder="Min 8 characters"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <Eye className="w-3.5 h-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    8+ characters, with uppercase, lowercase, a number, and a special character.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="fl">Role</label>
                <select
                  className="fi"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value as UserRole)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {showSubType ? (
                <div>
                  <label className="fl">Sub-Type</label>
                  <select
                    className="fi"
                    value={form.subType}
                    onChange={(e) => set('subType', e.target.value as UserSubType | '')}
                  >
                    <option value="">— None —</option>
                    <option value={UserSubType.JUNIOR}>Junior</option>
                    <option value={UserSubType.SENIOR}>Senior</option>
                  </select>
                </div>
              ) : null}

              {!isCreate ? (
                <div>
                  <label className="fl">Status</label>
                  <select
                    className="fi"
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => set('isActive', e.target.value === 'active')}
                    disabled={isSelf}
                    title={isSelf ? 'You cannot deactivate your own account' : undefined}
                    style={isSelf ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                  >
                    <option value="active">Active</option>
                    {!isSelf ? <option value="inactive">Inactive</option> : null}
                  </select>
                </div>
              ) : null}

              {error ? (
                <div
                  className="col-span-2 text-[12px] px-3 py-2 rounded-md"
                  style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)' }}
                >
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-actions">
          {editing ? (
            <>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-crimson" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : isCreate ? 'Create User' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {user && user.is_active && !isSelf ? (
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={() => setConfirmingDeactivate(true)}
                  style={{ marginRight: 'auto' }}
                >
                  <UserX className="w-3.5 h-3.5" aria-hidden />
                  Deactivate
                </button>
              ) : null}
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
              {!isAdminTarget ? (
                <button type="button" className="btn btn-crimson" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5" aria-hidden />
                  Edit
                </button>
              ) : null}
            </>
          )}
        </div>

      </div>

      <ConfirmModal
        open={confirmingDeactivate}
        tone="destructive"
        title="Deactivate user?"
        description={
          <>
            This signs <strong>{user?.name}</strong> out and marks their account inactive. Their job
            history is kept, and you can re-activate them later by editing the user.
          </>
        }
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmingDeactivate(false)}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
