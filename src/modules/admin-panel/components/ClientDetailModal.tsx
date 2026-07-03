import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Trash2 } from 'lucide-react';
import { ConfirmModal } from '@modules/shared-ui';
import type { IClient, ICardOnFile } from '@contracts';
import { PaymentMode } from '@contracts';
import { useDeleteClient, useUpdateClient } from '../hooks/use-admin-clients';
import type { UpdateClientBody } from '../services/admin.service';

export type ClientModalMode = 'view' | 'edit';

const PAYMENT_OPTIONS: { value: PaymentMode; label: string }[] = [
  { value: PaymentMode.CREDIT_CARD, label: 'Credit Card' },
  { value: PaymentMode.CARD_ON_FILE, label: 'Card on File' },
  { value: PaymentMode.ACH, label: 'ACH' },
  { value: PaymentMode.PAYPAL, label: 'PayPal' },
  { value: PaymentMode.CHECK, label: 'Check' },
];

function formatPaymentMode(mode: PaymentMode | null): string {
  if (!mode) return '—';
  return PAYMENT_OPTIONS.find((p) => p.value === mode)?.label ?? mode;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatCardOnFile(card: ICardOnFile | null): string {
  if (!card) return 'No card on file';
  const mm = String(card.exp_month).padStart(2, '0');
  const yy = String(card.exp_year % 100).padStart(2, '0');
  return `${card.brand} ending in ${card.last4} (Exp ${mm}/${yy})`;
}

interface ClientDetailModalProps {
  client: IClient | null;
  /** Initial mode — defaults to view. */
  mode?: ClientModalMode;
  onClose: () => void;
}

interface FormState {
  client_name: string;
  company_name: string;
  contact_name: string;
  contact_number: string;
  email: string;
  location: string;
  payment_mode: PaymentMode | '';
}

interface FieldErrors {
  client_name?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  location?: string;
}

function initialState(client: IClient | null): FormState {
  return {
    client_name: client?.client_name ?? '',
    company_name: client?.company_name ?? '',
    contact_name: client?.contact_name ?? '',
    contact_number: client?.contact_number ?? '',
    email: client?.email ?? '',
    location: client?.location ?? '',
    payment_mode: client?.payment_mode ?? '',
  };
}

const ERR_STYLE = { color: '#f87171' };

export function ClientDetailModal({ client, mode = 'view', onClose }: ClientDetailModalProps) {
  const [editing, setEditing] = useState(mode === 'edit');
  const [form, setForm] = useState<FormState>(() => initialState(client));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const update = useUpdateClient();
  const remove = useDeleteClient();
  const saving = update.isPending;

  useEffect(() => {
    setForm(initialState(client));
    setEditing(mode === 'edit');
    setError(null);
    setFieldErrors({});
  }, [client, mode]);

  useEffect(() => {
    if (!client) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmingDelete) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [client, onClose, confirmingDelete]);

  if (!client) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setFE = (key: keyof FieldErrors, msg: string | undefined) =>
    setFieldErrors((fe) => ({ ...fe, [key]: msg }));

  function handleNameChange(raw: string) {
    setFE('client_name', raw.length > 80 ? 'Maximum 80 characters allowed.' : undefined);
    set('client_name', raw.slice(0, 80));
  }

  function handleCompanyChange(raw: string) {
    setFE('company_name', raw.length > 80 ? 'Maximum 80 characters allowed.' : undefined);
    set('company_name', raw.slice(0, 80));
  }

  function handleContactNameChange(raw: string) {
    setFE('contact_name', raw.length > 80 ? 'Maximum 80 characters allowed.' : undefined);
    set('contact_name', raw.slice(0, 80));
  }

  function handlePhoneChange(raw: string) {
    if (/\D/.test(raw)) {
      setFE('contact_number', 'Only numbers are allowed.');
    } else if (raw.length > 13) {
      setFE('contact_number', 'Maximum 13 digits allowed.');
    } else {
      setFE('contact_number', undefined);
    }
    set('contact_number', raw.replace(/\D/g, '').slice(0, 13));
  }

  function handleEmailChange(raw: string) {
    if (/[^a-zA-Z0-9@._-]/.test(raw)) {
      setFE('email', 'Only letters, numbers, @, ., _, - are allowed.');
    } else if (raw.length > 80) {
      setFE('email', 'Maximum 80 characters allowed.');
    } else {
      setFE('email', undefined);
    }
    set('email', raw.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 80));
  }

  function handleLocationChange(raw: string) {
    setFE('location', raw.length > 200 ? 'Maximum 200 characters allowed.' : undefined);
    set('location', raw.slice(0, 200));
  }

  const viewRows: [string, string][] = [
    ['Client ID', client.client_id],
    ['Full Name', client.client_name],
    ['Company', client.company_name ?? '—'],
    ['Contact Person', client.contact_name],
    ['Phone', client.contact_number?.trim() ? client.contact_number : '—'],
    ['Email', client.email],
    ['Location', client.location ?? '—'],
    ['Address', client.address?.trim() ? client.address : '—'],
    ['Card on file', formatCardOnFile(client.card_on_file)],
    ['Payment Mode', formatPaymentMode(client.payment_mode)],
    ['Member Since', formatDate(client.date)],
    ['Record Created', formatDate(client.created_at)],
  ];

  function handleSave() {
    setError(null);
    if (!form.client_name.trim()) return setError('Full name is required.');
    if (!form.contact_name.trim()) return setError('Contact person is required.');
    if (!form.contact_number.trim()) return setError('Phone number is required.');
    if (form.contact_number.trim().length > 13) return setError('Phone number must be at most 13 digits.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError('A valid email is required.');


    // Only send non-empty optional fields — the backend's partial update treats
    // omitted keys as "leave unchanged", and payment_mode/company/location are
    // not nullable in the update schema.
    const body: UpdateClientBody = {
      client_name: form.client_name.trim(),
      contact_name: form.contact_name.trim(),
      contact_number: form.contact_number.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (form.company_name.trim()) body.company_name = form.company_name.trim();
    if (form.location.trim()) body.location = form.location.trim();
    if (form.payment_mode) body.payment_mode = form.payment_mode;

    update.mutate({ id: client!.id, body }, { onSuccess: onClose });
  }

  function handleDelete() {
    remove.mutate(client!.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onClose();
      },
      onError: () => setConfirmingDelete(false),
    });
  }

  const modal = (
    <div
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label={`Client: ${client.client_name}`}
    >
      <div className="modal" style={{ maxWidth: 540 }}>

        {/* Header */}
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-job-id">{client.client_id}</div>
            <div className="modal-title">{client.company_name ?? client.client_name}</div>
            <div className="modal-tags">
              <span className={`badge ${client.is_active ? 'green' : 'red'}`}>
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
              {client.is_hotlisted && <span className="badge amber">Hotlisted</span>}
              <span className="badge gray">{formatPaymentMode(client.payment_mode)}</span>
              <span className="badge blue">{client.email}</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {editing ? (
            <>
              <div className="m-sec-title">Edit Client</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pb-1">
                <div>
                  <label className="fl">Full Name</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    value={form.client_name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                  {fieldErrors.client_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.client_name}</div>
                  )}
                </div>
                <div>
                  <label className="fl">Company</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    value={form.company_name}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                  />
                  {fieldErrors.company_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.company_name}</div>
                  )}
                </div>
                <div>
                  <label className="fl">Contact Person</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    value={form.contact_name}
                    onChange={(e) => handleContactNameChange(e.target.value)}
                  />
                  {fieldErrors.contact_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.contact_name}</div>
                  )}
                </div>
                <div>
                  <label className="fl">Phone</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    inputMode="numeric"
                    value={form.contact_number}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                  {fieldErrors.contact_number && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.contact_number}</div>
                  )}
                </div>
                <div>
                  <label className="fl">Email</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                  />
                  {fieldErrors.email && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.email}</div>
                  )}
                </div>
                <div>
                  <label className="fl">Location</label>
                  <input
                    className="fi"
                    autoComplete="off"
                    value={form.location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                  />
                  {fieldErrors.location && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.location}</div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="fl">Payment Mode</label>
                  <select
                    className="fi"
                    value={form.payment_mode}
                    onChange={(e) => set('payment_mode', e.target.value as PaymentMode | '')}
                  >
                    <option value="">— Not set —</option>
                    {PAYMENT_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error ? (
                  <div
                    className="col-span-2 text-[12px] px-3 py-2 rounded-md"
                    style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)' }}
                  >
                    {error}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="m-sec-title">Client Details</div>
              {viewRows.map(([key, val]) => (
                <div key={key} className="f-row">
                  <div className="f-key">{key}</div>
                  <div className="f-val">{val}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-actions">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => (mode === 'edit' ? onClose() : setEditing(false))}
                disabled={saving}
                style={{ marginLeft: 'auto' }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-crimson" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-red"
                onClick={() => setConfirmingDelete(true)}
                style={{ marginRight: 'auto' }}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                Delete
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-crimson" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" aria-hidden />
                Edit
              </button>
            </>
          )}
        </div>

      </div>

      <ConfirmModal
        open={confirmingDelete}
        tone="destructive"
        title="Delete client?"
        description={
          <>
            This permanently removes <strong>{client.company_name ?? client.client_name}</strong> (
            {client.client_id}). Clients with existing job cards cannot be deleted.
          </>
        }
        confirmLabel="Delete Client"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
