import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import type { IClient } from '@contracts';
import { useProvisionClient } from '../hooks/use-admin-clients';

// ─── Password generation ──────────────────────────────────────────────────────

const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

function generatePassword(length = 14): string {
  const arr = new Uint8Array(length);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => PWD_CHARS[b % PWD_CHARS.length]).join('');
}

// ─── Options ─────────────────────────────────────────────────────────────────

const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'NZD', label: 'New Zealand Dollar (NZD)' },
  { value: 'SGD', label: 'Singapore Dollar (SGD)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CNY', label: 'Chinese Yuan (CNY)' },
  { value: 'KRW', label: 'South Korean Won (KRW)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
  { value: 'SAR', label: 'Saudi Riyal (SAR)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'SEK', label: 'Swedish Krona (SEK)' },
  { value: 'BRL', label: 'Brazilian Real (BRL)' },
  { value: 'MXN', label: 'Mexican Peso (MXN)' },
];

const COUNTRY_OPTIONS: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Canada',
  'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt',
  'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Guatemala',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Lebanon', 'Malaysia',
  'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman',
  'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'South Africa', 'South Korea',
  'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Vietnam', 'Zimbabwe',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  firstName: string;
  middleName: string;
  lastName: string;
  businessName: string;
  currency: string;
  email: string;
  phoneNumber: string;
  country: string;
  zipcode: string;
  city: string;
  state: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

const empty: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  businessName: '',
  currency: 'USD',
  email: '',
  phoneNumber: '',
  country: 'United States',
  zipcode: '',
  city: '',
  state: '',
};



interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Success step ─────────────────────────────────────────────────────────────

interface SuccessStepProps {
  client: IClient;
  password: string;
  onClose: () => void;
}

function SuccessStep({ client, password, onClose }: SuccessStepProps) {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  function copyPassword() {
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadCredentials() {
    const lines = [
      'CHANGE! — Client Sign-up Credentials',
      '─────────────────────────────────────',
      `Client ID : ${client.client_id}`,
      `Name      : ${client.client_name}`,
      `Company   : ${client.company_name ?? '—'}`,
      `Email     : ${client.email}`,
      `Password  : ${password}`,
      '',
      'Use these credentials when signing up on the client portal.',
      'You may change your password after your first login.',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${client.client_id}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal" style={{ maxWidth: 480 }}>
      <div className="modal-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="modal-job-id">{client.client_id}</div>
          <div className="modal-title">{client.company_name ?? client.client_name}</div>
          <div className="modal-tags">
            <span className="badge blue">{client.email}</span>
          </div>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <div className="modal-body">
        {/* Success banner */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-md mb-4 text-[13px] font-medium"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          Client account created successfully.
        </div>

        <div className="m-sec-title">Auto-generated password</div>
        <p className="text-[12px] text-text-faint mb-3">
          Share this email and password with the client. They should use these credentials when signing up on the client portal.
        </p>

        {/* Password display */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex-1 rounded-md px-3 py-2 font-mono text-[13px] select-all"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--glass-border)',
              letterSpacing: showPwd ? 'normal' : '0.15em',
              color: 'var(--text-primary)',
            }}
          >
            {showPwd ? password : '•'.repeat(password.length)}
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            title={showPwd ? 'Hide' : 'Show'}
          >
            {showPwd ? <EyeOff className="w-3.5 h-3.5" aria-hidden /> : <Eye className="w-3.5 h-3.5" aria-hidden />}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={copyPassword}
            aria-label="Copy password"
            title="Copy"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" aria-hidden />
              : <Copy className="w-3.5 h-3.5" aria-hidden />}
          </button>
        </div>

        {/* Client summary */}
        <div className="m-sec-title">Client details</div>
        {[
          ['Client ID', client.client_id],
          ['Name', client.client_name],
          ['Company', client.company_name ?? '—'],
          ['Email', client.email],
          ['Phone', client.contact_number],
          ['Location', client.location ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="f-row">
            <div className="f-key">{k}</div>
            <div className="f-val">{v}</div>
          </div>
        ))}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={downloadCredentials}>
          <Download className="w-3.5 h-3.5" aria-hidden />
          Download credentials
        </button>
        <button type="button" className="btn btn-crimson" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<FormErrors>({});
  const [password, setPassword] = useState(() => generatePassword());
  const [showPwd, setShowPwd] = useState(false);
  const [createdClient, setCreatedClient] = useState<IClient | null>(null);

  const provision = useProvisionClient();

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !createdClient) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, createdClient]);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setErrors({});
      setPassword(generatePassword());
      setShowPwd(false);
      setCreatedClient(null);
    }
  }, [open]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    if (!form.email.trim()) {
      e.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Enter a valid email address.';
    }
    if (!form.phoneNumber.trim()) {
      e.phoneNumber = 'Phone number is required.';
    } else if (form.phoneNumber.trim().length < 5) {
      e.phoneNumber = 'Enter a valid phone number.';
    }
    return e;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const fullName = [form.firstName.trim(), form.middleName.trim(), form.lastName.trim()]
      .filter(Boolean)
      .join(' ');

    const locationParts = [form.city.trim(), form.state.trim(), form.zipcode.trim()]
      .filter(Boolean);

    provision.mutate(
      {
        client_name: fullName,
        contact_name: fullName,
        email: form.email.trim().toLowerCase(),
        contact_number: form.phoneNumber.trim(),
        password,
        ...(form.businessName.trim() ? { company_name: form.businessName.trim() } : {}),
        ...(form.country.trim() ? { country: form.country.trim() } : {}),
        ...(form.currency ? { currency: form.currency } : {}),
        ...(locationParts.length ? { location: locationParts.join(', ') } : {}),
      },
      {
        onSuccess: (client) => setCreatedClient(client),
        onError: () => { /* toastApiError already called by hook */ },
      },
    );
  }

  const saving = provision.isPending;

  const modal = (
    <div
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label={createdClient ? 'Client Created' : 'Add Client'}
    >
      {createdClient ? (
        <SuccessStep client={createdClient} password={password} onClose={onClose} />
      ) : (
        <div className="modal" style={{ maxWidth: 620 }}>
          <div className="modal-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="modal-title">Add Client</div>
              <div className="modal-tags">
                <span className="badge blue">New account</span>
              </div>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>

          <div className="modal-body">
            <div className="m-sec-title">Client Information</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pb-1">

              <div>
                <label className="fl">First Name <span style={{ color: 'var(--color-crimson)' }}>*</span></label>
                <input
                  className="fi"
                  style={errors.firstName ? { borderColor: 'var(--color-crimson)' } : undefined}
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                />
                {errors.firstName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)' }}>{errors.firstName}</p>}
              </div>
              <div>
                <label className="fl">Email <span style={{ color: 'var(--color-crimson)' }}>*</span></label>
                <input
                  className="fi"
                  type="email"
                  style={errors.email ? { borderColor: 'var(--color-crimson)' } : undefined}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                {errors.email && <p className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)' }}>{errors.email}</p>}
              </div>

              <div>
                <label className="fl">Middle Name</label>
                <input className="fi" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
              </div>
              <div>
                <label className="fl">Phone Number <span style={{ color: 'var(--color-crimson)' }}>*</span></label>
                <input
                  className="fi"
                  type="tel"
                  style={errors.phoneNumber ? { borderColor: 'var(--color-crimson)' } : undefined}
                  value={form.phoneNumber}
                  onChange={(e) => set('phoneNumber', e.target.value)}
                />
                {errors.phoneNumber && <p className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)' }}>{errors.phoneNumber}</p>}
              </div>

              <div>
                <label className="fl">Last Name <span style={{ color: 'var(--color-crimson)' }}>*</span></label>
                <input
                  className="fi"
                  style={errors.lastName ? { borderColor: 'var(--color-crimson)' } : undefined}
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
                {errors.lastName && <p className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)' }}>{errors.lastName}</p>}
              </div>
              <div>
                <label className="fl">Country</label>
                <select className="fi" value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="fl">Business Name</label>
                <input className="fi" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
              </div>
              <div>
                <label className="fl">Zipcode</label>
                <input className="fi" value={form.zipcode} onChange={(e) => set('zipcode', e.target.value)} />
              </div>

              <div>
                <label className="fl">Currency</label>
                <select className="fi" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fl">City</label>
                <input className="fi" value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>

              <div />
              <div>
                <label className="fl">State</label>
                <input className="fi" value={form.state} onChange={(e) => set('state', e.target.value)} />
              </div>

            </div>

            {/* Password row */}
            <div className="m-sec-title" style={{ marginTop: '1rem' }}>Auto-generated Password</div>
            <p className="text-[12px] text-text-faint mb-2">
              This password is generated automatically. You can regenerate it before saving.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  className="fi pr-8 font-mono"
                  readOnly
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  aria-label="Auto-generated password"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-primary transition-colors"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd
                    ? <EyeOff className="w-3.5 h-3.5" aria-hidden />
                    : <Eye className="w-3.5 h-3.5" aria-hidden />}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPassword(generatePassword())}
                title="Generate new password"
                aria-label="Regenerate password"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-crimson" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating…' : 'Add Client'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
