import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Lock,
  Briefcase,
  Building2,
  CreditCard,
  ShieldAlert,
  Info,
  Tag,
  Send,
  Loader2,
  ChevronDown,
  Check,
  FileText,
  StickyNote,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@modules/shared-ui';
import type { IClient } from '@contracts';
import { PaymentMode } from '@contracts';
import { getDateRangeFromPreset } from '@lib/utils';
import {
  useAdminClientPaymentMethods,
  useDeleteClient,
  useSendCcForm,
  useUpdateClient,
} from '../hooks/use-admin-clients';
import { useAdminJobCards } from '../hooks/use-admin-jobs';
import type { UpdateClientBody } from '../services/admin.service';

export type ClientModalMode = 'view' | 'edit';

/**
 * TODO(backend): default_instruction / internal_notes / notes / additional_info /
 * created_by / updated_by exist on the `clients` table as of migration
 * 0020_client_admin_notes.sql but aren't wired through the repository, API, or
 * IClient contract yet. These placeholders stand in until that's done — swap
 * them for the real `client.*` fields at that point.
 */
const DEFAULT_INSTRUCTION_PLACEHOLDER =
  'Please ensure all designs are created as per the attached specifications. For any clarifications, contact our team before starting the work. Attach sewout if required.';
const INTERNAL_NOTES_PLACEHOLDER =
  'Client prefers email communication. High priority client — ensure quick turnaround.';
const NOTES_PLACEHOLDER = 'Preferred contact via email.';
const STAFF_NAME_PLACEHOLDER = 'Admin User';

const COUNTRY_ISO_MAP: Record<string, string> = {
  'united states': 'us', 'usa': 'us', 'us': 'us',
  'canada': 'ca', 'mexico': 'mx', 'panama': 'pa',
  'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb', 'scotland': 'gb',
  'germany': 'de', 'france': 'fr', 'italy': 'it', 'spain': 'es', 'portugal': 'pt',
  'netherlands': 'nl', 'belgium': 'be', 'switzerland': 'ch', 'austria': 'at',
  'sweden': 'se', 'norway': 'no', 'denmark': 'dk', 'finland': 'fi',
  'ireland': 'ie', 'poland': 'pl', 'czech republic': 'cz', 'greece': 'gr',
  'india': 'in', 'china': 'cn', 'japan': 'jp', 'south korea': 'kr', 'singapore': 'sg',
  'australia': 'au', 'new zealand': 'nz', 'brazil': 'br', 'argentina': 'ar',
  'south africa': 'za', 'egypt': 'eg', 'nigeria': 'ng',
  'united arab emirates': 'ae', 'uae': 'ae', 'saudi arabia': 'sa',
};

function getCountryFlagUrl(country?: string | null): string | null {
  if (!country) return null;
  const str = country.trim().toLowerCase();
  if (COUNTRY_ISO_MAP[str]) return `https://flagcdn.com/w40/${COUNTRY_ISO_MAP[str]}.png`;
  for (const [name, code] of Object.entries(COUNTRY_ISO_MAP)) {
    if (str.includes(name)) return `https://flagcdn.com/w40/${code}.png`;
  }
  if (str.length === 2 && /^[a-z]{2}$/.test(str)) return `https://flagcdn.com/w40/${str}.png`;
  return null;
}

/** `client.location` is stored as a free-text "City, State/Province, ZIP" string. */
function parseLocation(location?: string | null): { city: string; state: string; zip: string } {
  const parts = (location ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return {
    city: parts[0] ?? '',
    state: parts[1] ?? '',
    zip: parts[2] ?? '',
  };
}

function formatFullDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFullDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dateStr = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} ${timeStr}`;
}

const JOBS_RANGE_OPTIONS = ['Last 1 Week', 'Last 15 Days', 'Last 1 Month', 'All Time'];

interface JobsRangeDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Custom-styled dropdown for the jobs date range. Portalled with fixed
 * positioning (mirrors RowActionsMenu) so the panel isn't clipped by the
 * modal's `overflow-y-auto` body and never overlaps unrelated content below it.
 */
function JobsRangeDropdown({ value, onChange }: JobsRangeDropdownProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 140) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-7 rounded-[6px] border border-blue-300 bg-white pl-2.5 pr-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs focus:outline-none flex items-center gap-1 shrink-0 whitespace-nowrap"
      >
        <span>{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-blue-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[59]" role="presentation" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                className="fixed z-[60] rounded-[6px] border border-slate-200 bg-white shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
              >
                {JOBS_RANGE_OPTIONS.map((opt) => {
                  const active = opt === value;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] text-left cursor-pointer transition-colors ${
                        active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <span>{opt}</span>
                      {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

const PAYMENT_OPTIONS: { value: PaymentMode; label: string }[] = [
  { value: PaymentMode.CREDIT_CARD, label: 'Credit Card' },
  { value: PaymentMode.CARD_ON_FILE, label: 'Card on File' },
  { value: PaymentMode.ACH, label: 'ACH' },
  { value: PaymentMode.PAYPAL, label: 'PayPal' },
  { value: PaymentMode.CHECK, label: 'Check' },
];

function formatPaymentMode(mode: PaymentMode | null | string): string {
  if (!mode) return '—';
  return PAYMENT_OPTIONS.find((p) => p.value === mode)?.label ?? String(mode);
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', CAD: 'Canadian Dollar', GBP: 'British Pound', EUR: 'Euro',
  AUD: 'Australian Dollar', NZD: 'New Zealand Dollar', INR: 'Indian Rupee',
  JPY: 'Japanese Yen', CNY: 'Chinese Yuan', SGD: 'Singapore Dollar', AED: 'UAE Dirham',
};

function formatCurrency(code?: string | null): string {
  if (!code) return '—';
  const name = CURRENCY_NAMES[code.toUpperCase()];
  return name ? `${code.toUpperCase()} - ${name}` : code.toUpperCase();
}

interface ClientDetailModalProps {
  client: IClient | null;
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
  const navigate = useNavigate();
  const [editing, setEditing] = useState(mode === 'edit');
  const [form, setForm] = useState<FormState>(() => initialState(client));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [jobsRange, setJobsRange] = useState('Last 1 Month');

  const update = useUpdateClient();
  const remove = useDeleteClient();
  const sendCcForm = useSendCcForm();
  const saving = update.isPending;

  function handleViewJobs() {
    if (!client) return;
    const { dateFrom, dateTo } = getDateRangeFromPreset(jobsRange);
    const clientId = client.client_id || client.id;

    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (jobsRange) params.set('range', jobsRange);

    onClose();

    const isCs = window.location.pathname.startsWith('/cs');
    const targetPath = isCs ? '/cs/projects' : '/admin/projects';
    navigate(`${targetPath}?${params.toString()}`);
  }

  // Query real database jobs for this client
  const { data: jobsData, isLoading: isJobsLoading } = useAdminJobCards({
    client_id: client?.id,
    per_page: 250,
  });

  const clientJobs = jobsData?.items ?? [];

  const { data: paymentMethods, isLoading: isPaymentMethodsLoading } = useAdminClientPaymentMethods(
    client?.id ?? null,
  );

  // Filter jobs count dynamically based on date range dropdown
  const filteredJobsCount = useMemo(() => {
    if (jobsRange === 'All Time' || jobsRange === 'Custom Range') return clientJobs.length;

    const now = Date.now();
    let days = 30;
    if (jobsRange === 'Last 1 Week') days = 7;
    if (jobsRange === 'Last 15 Days') days = 15;
    if (jobsRange === 'Last 1 Month') days = 30;

    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return clientJobs.filter((j) => {
      const t = j.created_at ? new Date(j.created_at).getTime() : 0;
      return t >= cutoff;
    }).length;
  }, [clientJobs, jobsRange]);

  useEffect(() => {
    setForm(initialState(client));
    setEditing(mode === 'edit');
    setError(null);
    setFieldErrors({});
  }, [client, mode]);

  useEffect(() => {
    if (!client) return undefined;

    const mainEl = document.getElementById('main-content');

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) mainEl.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmingDelete) onClose();
    };
    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (mainEl) mainEl.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [client, onClose, confirmingDelete]);

  if (!client) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setFE = (key: keyof FieldErrors, msg: string | undefined) =>
    setFieldErrors((fe) => ({ ...fe, [key]: msg }));

  function handleSendCcForm() {
    if (client?.id) {
      sendCcForm.mutate(client.id);
    } else {
      toast.success(`Credit Card Authorization form sent to ${client?.client_name ?? 'client'}`);
    }
  }

  function handleResetPassword() {
    toast.success(`Password reset email sent to ${client?.email ?? 'client'}`);
  }

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

  function handleSave() {
    setError(null);
    if (!form.client_name.trim()) return setError('Full name is required.');
    if (!form.contact_name.trim()) return setError('Contact person is required.');
    if (!form.contact_number.trim()) return setError('Phone number is required.');
    if (form.contact_number.trim().length > 13) return setError('Phone number must be at most 13 digits.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError('A valid email is required.');

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

  const clientName = client.client_name || client.company_name || '—';
  const companyName = client.company_name || client.client_name || '—';
  const displayId = client.client_id || '—';
  const displayCountry = client.country || '';
  const flagUrl = getCountryFlagUrl(displayCountry);
  const { city, state, zip } = parseLocation(client.location);

  const cardOnFile = client.card_on_file;
  const cardExpiry = cardOnFile
    ? `${String(cardOnFile.exp_month).padStart(2, '0')}/${String(cardOnFile.exp_year).slice(-2)}`
    : null;

  const approvalStatusLabel =
    client.approval_status === 'PENDING'
      ? 'Pending Approval'
      : client.approval_status === 'REJECTED'
        ? 'Rejected'
        : client.approval_status === 'APPROVED'
          ? 'Approved'
          : 'Manually Created';

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`Client Details: ${clientName}`}
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── MODAL HEADER ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Client Details</h2>
          <button
            type="button"
            className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {/* ── MODAL BODY (SCROLLABLE) ── */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {editing ? (
            /* EDIT FORM */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">Edit Client Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Client Name</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.client_name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                  {fieldErrors.client_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.client_name}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Company Name</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.company_name}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                  />
                  {fieldErrors.company_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.company_name}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.contact_name}
                    onChange={(e) => handleContactNameChange(e.target.value)}
                  />
                  {fieldErrors.contact_name && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.contact_name}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.contact_number}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                  {fieldErrors.contact_number && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.contact_number}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                  />
                  {fieldErrors.email && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.email}</div>
                  )}
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Location / Country</label>
                  <input
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    value={form.location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                  />
                  {fieldErrors.location && (
                    <div className="text-[11px] mt-0.5" style={ERR_STYLE}>{fieldErrors.location}</div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
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
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* VIEW MODE */
            <>
              {/* 1. TOP SUMMARY SECTION */}
              <div className="flex gap-4">
                {/* Pink Building Icon Box (own column so the row below aligns with Client ID, not the icon) */}
                <div className="w-14 h-14 rounded-[6px] bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>

                <div className="flex-1 min-w-0 space-y-4">
                  {/* Upper Row: Client ID, Divider, Status, Accounting, Joined On, Record Created, Reset Password */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {/* Client ID */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-0.5">Client ID</span>
                      <span className="text-2xl font-black text-[#e11d48] tracking-tight">{displayId}</span>
                    </div>

                    {/* Vertical Divider */}
                    <div className="hidden sm:block w-[1px] h-10 bg-slate-200" />

                    {/* Status */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
                      {client.is_active !== false ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-rose-50 text-rose-500 border border-rose-200/80">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Accounting */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1">Accounting</span>
                      <span className="text-xs font-bold text-slate-700">
                        {client.is_hotlisted ? 'Hotlisted' : client.cc_form_sent_at ? 'Updated CC Required' : '-'}
                      </span>
                    </div>

                    {/* Joined On (member-since date) */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1">Joined On</span>
                      <span className="text-xs font-bold text-slate-900">{formatFullDate(client.date)}</span>
                    </div>

                    {/* Record Created */}
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1">Record Created</span>
                      <span className="text-xs font-bold text-slate-900">{formatFullDate(client.created_at)}</span>
                    </div>

                    {/* Reset Password Button */}
                    <div className="ml-auto">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition text-xs font-semibold shadow-2xs cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-500" />
                        <span>Reset Password</span>
                      </button>
                    </div>
                  </div>

                  {/* Lower Row: 2 Separate Cards (Left: Account Overview, Right: Total Jobs) */}
                  <div className="flex flex-wrap items-stretch gap-4">
                    {/* Left Card: Account Overview */}
                    <div className="flex-1 min-w-0 rounded-[6px] border border-slate-200/90 bg-white p-3.5 flex items-center justify-between gap-x-3 shadow-2xs">
                      <div className="min-w-0">
                        <span className="block text-[11px] font-medium text-slate-400 mb-0.5 whitespace-nowrap">Contact Person</span>
                        <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{client.contact_name || '—'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[11px] font-medium text-slate-400 mb-0.5 whitespace-nowrap">Signup Source</span>
                        <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{approvalStatusLabel}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[11px] font-medium text-slate-400 mb-0.5 whitespace-nowrap">Portal Login</span>
                        <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{client.user_id ? 'Linked' : 'Not linked'}</span>
                      </div>
                    </div>

                    {/* Right Card: Total Jobs Given (REAL BACKEND DATA FETCHED VIA API) */}
                    <div className="shrink-0 rounded-[6px] border border-blue-100 bg-[#f0f5ff] px-3 py-2.5 flex items-center gap-2.5 shadow-2xs">
                      <div className="w-8 h-8 rounded-[6px] bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="shrink-0">
                        <span className="block text-[11px] font-semibold text-slate-700 leading-tight whitespace-nowrap">Total Jobs Given</span>
                        {isJobsLoading ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            <span className="text-xs text-blue-500 font-semibold">Loading...</span>
                          </div>
                        ) : (
                          <span className="text-xl font-black text-blue-600 leading-none">{filteredJobsCount}</span>
                        )}
                      </div>

                      <JobsRangeDropdown value={jobsRange} onChange={setJobsRange} />
                      <button
                        type="button"
                        onClick={handleViewJobs}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>View Jobs</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SECTION 1: BUSINESS INFORMATION */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <span>Business Information</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-12 pt-1 text-xs">
                  {/* Left Column */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Client Name</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{clientName}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Business Name</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{companyName}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Email</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.email || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Phone Number</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.contact_number || '—'}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Business Address</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">City</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{city || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">State / Province</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{state || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2 items-center">
                      <span className="text-slate-500 font-medium">Country</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                        {flagUrl ? (
                          <img
                            src={flagUrl}
                            alt={displayCountry}
                            className="w-4 h-3 object-cover rounded-[1px] shadow-2xs border border-slate-200/80 shrink-0"
                          />
                        ) : null}
                        <span>{displayCountry || '—'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">ZIP / Postal Code</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{zip || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SECTION 2: PAYMENT INFORMATION */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                    <CreditCard className="w-3.5 h-3.5" />
                  </span>
                  <span>Payment Information</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-1 text-xs">
                  <div className="grid grid-cols-[90px_12px_1fr] gap-x-2">
                    <span className="text-slate-500 font-medium">Currency</span>
                    <span className="font-semibold text-slate-900">:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(client.currency)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[100px_12px_1fr] gap-x-2">
                      <span className="text-slate-500 font-medium">Payment Mode</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{formatPaymentMode(client.payment_mode)}</span>
                    </div>
                    {cardOnFile ? (
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 font-medium">Card Last Four Digits</span>
                          <span className="font-semibold text-slate-800">: {cardOnFile.last4}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 font-medium">Card Expiry Date</span>
                          <span className="font-semibold text-slate-800">: {cardExpiry}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">No card on file</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-slate-500 font-medium">Payment Methods on File</span>
                    {isPaymentMethodsLoading ? (
                      <span className="text-[11px] text-slate-400">Loading…</span>
                    ) : paymentMethods && paymentMethods.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {paymentMethods.map((pm) => (
                          <div key={pm.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                            <span>{formatPaymentMode(pm.type)}</span>
                            {pm.is_default && (
                              <span className="px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold bg-rose-50 text-rose-600 border border-rose-200/80">
                                Default
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">No payment methods on file</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. SECTION 3: ACCOUNTING INFORMATION */}
              <div className="pt-2 border-t border-slate-100">
                <div className="rounded-[6px] border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </span>
                    <span>Accounting Information</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Accounting Status</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-bold border ${client.is_hotlisted
                            ? 'bg-rose-50 text-rose-600 border-rose-200/80'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200/80'
                          }`}
                      >
                        {client.is_hotlisted ? 'Hotlisted' : 'Good Standing'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">CC Form Sent</span>
                      <span className="font-semibold text-slate-900">: {client.cc_form_sent_at ? formatFullDate(client.cc_form_sent_at) : 'Not sent'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Hotlisted Since</span>
                      <span className="font-semibold text-slate-900">: {client.hotlisted_at ? formatFullDate(client.hotlisted_at) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. SECTIONS 4-7: DEFAULT INSTRUCTION, INTERNAL NOTES, ADDITIONAL INFORMATION, SYSTEM INFORMATION */}
              <div className="pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 relative">
                  {/* Vertical Center Divider Line */}
                  <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-100 pointer-events-none" />

                  {/* Top Left: Default Instruction */}
                  <div className="md:pr-6 pb-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <span>Default Instruction</span>
                    </div>
                    <div className="rounded-[6px] bg-[#f4f7fb] border border-slate-200/70 p-3.5 text-xs leading-relaxed text-slate-700">
                      {DEFAULT_INSTRUCTION_PLACEHOLDER}
                    </div>
                  </div>

                  {/* Top Right: Internal Notes */}
                  <div className="md:pl-6 pb-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                        <StickyNote className="w-3.5 h-3.5" />
                      </span>
                      <span>Internal Notes</span>
                    </div>
                    <div className="rounded-[6px] bg-[#fffbeb] border border-[#fde68a] p-3.5 text-xs text-slate-800 space-y-3">
                      <div className="space-y-1 leading-relaxed">
                        <p>{INTERNAL_NOTES_PLACEHOLDER}</p>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                        <div>Added by: <span className="font-semibold text-slate-900">{STAFF_NAME_PLACEHOLDER}</span></div>
                        <div>On: <span className="font-semibold text-slate-900">{formatFullDateTime(client.created_at)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Center Divider Line */}
                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 my-0" />

                  {/* Bottom Left: Additional Information */}
                  <div className="md:pr-6 pt-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <span>Additional Information</span>
                    </div>
                    <div className="space-y-2 text-xs pt-0.5">
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Notes</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{NOTES_PLACEHOLDER}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Additional Info</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">—</span>
                      </div>
                      {client.approval_status === 'REJECTED' && client.rejection_note && (
                        <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                          <span className="text-slate-500 font-medium">Rejection Note</span>
                          <span className="font-semibold text-slate-900">:</span>
                          <span className="font-semibold text-slate-900">{client.rejection_note}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Right: System Information */}
                  <div className="md:pl-6 pt-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                        <Tag className="w-3.5 h-3.5" />
                      </span>
                      <span>System Information</span>
                    </div>
                    <div className="space-y-2 text-xs pt-0.5">
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Created On</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{formatFullDateTime(client.created_at)}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Created By</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{STAFF_NAME_PLACEHOLDER}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Last Updated On</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{formatFullDateTime(client.updated_at)}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Last Updated By</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{STAFF_NAME_PLACEHOLDER}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div>
            <button
              type="button"
              onClick={handleSendCcForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-purple-600" />
              <span>Send CC Form</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {editing ? (
              <>
                <button
                  type="button"
                  className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
                  onClick={() => (mode === 'edit' ? onClose() : setEditing(false))}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-5 py-2 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs shadow-2xs transition cursor-pointer"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="px-5 py-2 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs shadow-2xs transition cursor-pointer"
                  onClick={() => setEditing(true)}
                >
                  Edit Client
                </button>
              </>
            )}
          </div>
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
