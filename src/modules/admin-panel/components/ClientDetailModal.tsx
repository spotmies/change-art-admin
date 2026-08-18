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
  Mail,
  Loader2,
  ChevronDown,
  Check,
  FileText,
  StickyNote,
  Pencil,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@modules/shared-ui';
import type { IClient } from '@contracts';
import type { PaymentMode } from '@contracts';
import { getDateRangeFromPreset } from '@lib/utils';
import {
  useDeleteClient,
  useResetClientPassword,
  useSendCcForm,
  useSetClientAccountingStatus,
  useSetClientHotlisted,
  useUpdateClient,
} from '../hooks/use-admin-clients';
import { useAdminJobCards } from '../hooks/use-admin-jobs';
import type { UpdateClientBody } from '../services/admin.service';
import { formatPaymentMode, formatPaymentTerms, parsePaymentDetails, PAYMENT_MODE_LABELS } from '../utils/payment-display';
import { useSessionUser } from '../../auth/stores/auth-store';

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
        className="h-8 min-w-[130px] rounded-[6px] border border-blue-300 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs focus:outline-none flex items-center justify-between gap-2 shrink-0 whitespace-nowrap transition-colors"
      >
        <span>{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#2563eb] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[59]" role="presentation" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                className="fixed z-[60] rounded-[6px] border border-blue-100 bg-white shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[130px]"
                style={{ top: pos.top, left: pos.left }}
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

interface DepartmentDropdownProps {
  value: 'Artwork' | 'Digitizing';
  onChange: (value: 'Artwork' | 'Digitizing') => void;
}

function DepartmentDropdown({ value, onChange }: DepartmentDropdownProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 120) });
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

  const options: ('Artwork' | 'Digitizing')[] = ['Artwork', 'Digitizing'];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-8 min-w-[120px] rounded-[3px] border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-900 hover:border-slate-400 hover:bg-slate-50 cursor-pointer shadow-2xs focus:outline-none flex items-center justify-between gap-2.5 shrink-0 whitespace-nowrap transition-all"
      >
        <span>{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${open ? 'rotate-180 text-rose-600' : ''}`} />
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[59]" role="presentation" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                className="fixed z-[60] rounded-[3px] border border-slate-200 bg-white shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[120px]"
                style={{ top: pos.top, left: pos.left }}
              >
                {options.map((opt) => {
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
                        active ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-700 font-semibold hover:bg-slate-50'
                      }`}
                    >
                      <span>{opt}</span>
                      {active && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
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

interface AccountingStatusDropdownProps {
  value: 'hotlisted' | 'send_cc_form' | 'others';
  onChange: (value: 'hotlisted' | 'send_cc_form' | 'others') => void;
  disabled?: boolean;
}

function AccountingStatusDropdown({ value, onChange, disabled }: AccountingStatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 130) });
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

  const labelMap: Record<'hotlisted' | 'send_cc_form' | 'others', string> = {
    hotlisted: 'Hotlisted',
    send_cc_form: 'Send CC Form',
    others: 'Others',
  };

  const styleMap: Record<'hotlisted' | 'send_cc_form' | 'others', string> = {
    hotlisted: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100/70',
    send_cc_form: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70',
    others: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/70',
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`h-8 w-[150px] px-3 rounded-[6px] text-[11.5px] font-bold border transition shadow-2xs cursor-pointer flex items-center justify-between gap-2 shrink-0 ${styleMap[value]}`}
      >
        <span>{labelMap[value]}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180 text-slate-700' : 'text-slate-400'}`} />
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[59]" role="presentation" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                className="fixed z-[60] rounded-[6px] border border-slate-200 bg-white shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[130px]"
                style={{ top: pos.top, left: pos.left }}
              >
                {(['hotlisted', 'send_cc_form', 'others'] as const).map((opt) => {
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
                      className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[11.5px] text-left cursor-pointer transition-colors ${
                        active
                          ? opt === 'hotlisted'
                            ? 'bg-rose-50 text-rose-600 font-bold'
                            : opt === 'send_cc_form'
                            ? 'bg-purple-50 text-purple-700 font-bold'
                            : 'bg-emerald-50 text-emerald-600 font-bold'
                          : 'text-slate-700 font-semibold hover:bg-slate-50'
                      }`}
                    >
                      <span>{labelMap[opt]}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
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

const PAYMENT_OPTIONS = PAYMENT_MODE_LABELS;

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', CAD: 'Canadian Dollar', GBP: 'British Pound', EUR: 'Euro',
  AUD: 'Australian Dollar', NZD: 'New Zealand Dollar', INR: 'Indian Rupee',
  JPY: 'Japanese Yen', CNY: 'Chinese Yuan', SGD: 'Singapore Dollar', AED: 'UAE Dirham',
};

function formatCurrency(code?: string | null): string {
  if (!code) return '—';
  const name = CURRENCY_NAMES[code.toUpperCase()];
  return name ? `${code.toUpperCase()} (${name})` : code.toUpperCase();
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
  const [defaultDepartment, setDefaultDepartment] = useState<'Artwork' | 'Digitizing'>('Artwork');



  const update = useUpdateClient();
  const remove = useDeleteClient();
  const sendCcForm = useSendCcForm();
  const resetClientPassword = useResetClientPassword();
  const setClientHotlisted = useSetClientHotlisted();
  const setAccountingStatus = useSetClientAccountingStatus();
  const saving = update.isPending;

  const sessionUser = useSessionUser();
  const currentUserName = sessionUser?.name || 'Admin User';
  const lastUpdatedBy = client?.updated_by_name || currentUserName;

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [accountingNotes, setAccountingNotes] = useState(client?.accounting_notes ?? '');

  useEffect(() => {
    setAccountingNotes(client?.accounting_notes ?? '');
  }, [client?.accounting_notes]);

  function handleSaveAccountingNotes() {
    if (!client) return;
    const valToSave = accountingNotes.trim() || null;
    const currentVal = client.accounting_notes ?? null;
    if (valToSave !== currentVal) {
      update.mutate({ id: client.id, body: { accounting_notes: valToSave, updated_by_name: currentUserName } });
    }
    setIsEditingNotes(false);
  }

  function handleCancelNotes() {
    setAccountingNotes(client?.accounting_notes ?? '');
    setIsEditingNotes(false);
  }

  const [isEditingInstruction, setIsEditingInstruction] = useState(false);
  const [defaultInstruction, setDefaultInstruction] = useState(client?.default_instruction ?? '');

  const [isEditingInternalNotes, setIsEditingInternalNotes] = useState(false);
  const [internalNotesText, setInternalNotesText] = useState(client?.internal_notes ?? '');

  useEffect(() => {
    setDefaultInstruction(client?.default_instruction ?? '');
    setInternalNotesText(client?.internal_notes ?? '');
  }, [client?.default_instruction, client?.internal_notes]);

  function handleSaveDefaultInstruction() {
    if (!client) return;
    const valToSave = defaultInstruction.trim() || null;
    const currentVal = client.default_instruction ?? null;
    if (valToSave !== currentVal) {
      update.mutate({ id: client.id, body: { default_instruction: valToSave, updated_by_name: currentUserName } });
    }
    setIsEditingInstruction(false);
  }

  function handleCancelDefaultInstruction() {
    setDefaultInstruction(client?.default_instruction ?? '');
    setIsEditingInstruction(false);
  }

  function handleSaveInternalNotes() {
    if (!client) return;
    const valToSave = internalNotesText.trim() || null;
    const currentVal = client.internal_notes ?? null;
    if (valToSave !== currentVal) {
      update.mutate({ id: client.id, body: { internal_notes: valToSave, updated_by_name: currentUserName } });
    }
    setIsEditingInternalNotes(false);
  }

  function handleCancelInternalNotes() {
    setInternalNotesText(client?.internal_notes ?? '');
    setIsEditingInternalNotes(false);
  }

  const [isEditingAdditionalInfo, setIsEditingAdditionalInfo] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState(client?.notes ?? '');
  const [additionalInfoText, setAdditionalInfoText] = useState(client?.additional_info ?? '');

  useEffect(() => {
    setAdditionalNotes(client?.notes ?? '');
    setAdditionalInfoText(client?.additional_info ?? '');
  }, [client?.notes, client?.additional_info]);

  function handleSaveAdditionalInfo() {
    if (!client) return;
    const notesVal = additionalNotes.trim() || null;
    const infoVal = additionalInfoText.trim() || null;
    update.mutate({
      id: client.id,
      body: {
        notes: notesVal,
        additional_info: infoVal,
        updated_by_name: currentUserName,
      },
    });
    setIsEditingAdditionalInfo(false);
  }

  function handleCancelAdditionalInfo() {
    setAdditionalNotes(client?.notes ?? '');
    setAdditionalInfoText(client?.additional_info ?? '');
    setIsEditingAdditionalInfo(false);
  }

  let currentAccountingStatus = 'others';
  if (client?.is_hotlisted) {
    currentAccountingStatus = 'hotlisted';
  } else if (client?.cc_form_sent_at) {
    currentAccountingStatus = 'send_cc_form';
  }

  function handleAccountingStatusChange(selectedVal: 'hotlisted' | 'send_cc_form' | 'others') {
    if (!client) return;
    setAccountingStatus.mutate({ id: client.id, status: selectedVal });
  }

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
    if (client?.id) {
      resetClientPassword.mutate(client.id);
    } else {
      toast.success(`Password reset email sent to ${client?.email ?? 'client'}`);
    }
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
  // Prefer the dedicated city/state/zipcode columns; fall back to parsing the
  // legacy free-text `location` string for older records created before those
  // columns existed (migration 0020_client_signup_fields.sql).
  const parsedLocation = parseLocation(client.location);
  const city = client.city || parsedLocation.city;
  const state = client.state || parsedLocation.state;
  const zip = client.zipcode || parsedLocation.zip;

  const cardOnFile = client.card_on_file;
  const cardExpiry = cardOnFile
    ? `${String(cardOnFile.exp_month).padStart(2, '0')}/${String(cardOnFile.exp_year).slice(-2)}`
    : null;
  const paymentDetailFields = parsePaymentDetails(client.payment_mode, client.payment_details);
  const isCreatedByUser = Boolean(client.approval_status || client.terms_accepted_at);
  const createdByLabel = isCreatedByUser ? 'Portal Login' : 'Admin User';

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
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
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
        <div className="px-6 pt-3 pb-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {editing ? (
            /* EDIT FORM */
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
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
            </form>
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
                  <div className="flex items-center justify-between gap-x-6 overflow-x-auto pb-1">
                    <div className="grid grid-cols-[auto_1px_auto_auto_auto_auto] gap-x-6 gap-y-1 items-center min-w-0">
                      {/* TOP LINE: LABELS */}
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Client ID</span>
                      <div className="hidden sm:block w-[1px] h-7 bg-slate-200 row-span-2 self-center" />
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Status</span>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Accounting</span>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Joined On</span>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Last Login</span>

                      {/* BOTTOM LINE: VALUES */}
                      <span className="text-lg font-bold text-[#e11d48] font-mono tracking-tight leading-none whitespace-nowrap">{displayId}</span>
                      {/* Column 2 divider handles vertical line */}
                      <div>
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
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        {client.is_hotlisted ? 'Hotlisted' : client.cc_form_sent_at ? 'Updated CC Required' : '-'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{formatFullDate(client.date)}</span>
                      <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                        {formatFullDateTime(client.last_login_at ?? client.updated_at ?? client.created_at)}
                      </span>
                    </div>

                    {/* Reset Password Button */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={resetClientPassword.isPending}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition text-xs font-semibold shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Lock className="w-3.5 h-3.5 text-rose-500" />
                        <span>{resetClientPassword.isPending ? 'Sending…' : 'Reset Password'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Lower Row: 2 Separate Cards (Left: Account Overview, Right: Total Jobs) */}
                  <div className="flex flex-nowrap items-stretch gap-4 overflow-x-auto pb-0.5">
                    {/* Left Card: Account Overview */}
                    <div className="flex-1 min-w-0 rounded-[4px] border border-slate-200/90 bg-white px-4 py-3 flex items-center justify-between gap-x-6 shrink-0 shadow-2xs">
                      <div className="min-w-0 flex flex-col justify-center">
                        <span className="block text-[11px] font-semibold text-slate-400 mb-1 whitespace-nowrap">Client Group</span>
                        <span className="text-xs font-bold text-slate-900 whitespace-nowrap h-8 flex items-center">Standard</span>
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <span className="block text-[11px] font-semibold text-slate-400 mb-1 whitespace-nowrap">Default Department</span>
                        <DepartmentDropdown value={defaultDepartment} onChange={setDefaultDepartment} />
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <span className="block text-[11px] font-semibold text-slate-400 mb-1 whitespace-nowrap">Created By</span>
                        <span className="text-xs font-bold text-slate-900 whitespace-nowrap h-8 flex items-center">{createdByLabel}</span>
                      </div>
                    </div>

                    {/* Right Card: Total Jobs Given */}
                    <div className="shrink-0 rounded-[8px] border border-blue-100 bg-[#f0f7ff] px-4 py-3 flex items-center gap-4 shadow-2xs">
                      <div className="w-11 h-11 rounded-[8px] bg-blue-100/80 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                        <Briefcase className="w-6 h-6 text-[#2563eb]" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="block text-[12px] font-bold text-slate-600 mb-1 leading-tight whitespace-nowrap">
                          Total Jobs Given
                        </span>

                        <div className="flex items-center gap-3">
                          {isJobsLoading ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              <span className="text-xs text-blue-500 font-semibold">Loading...</span>
                            </div>
                          ) : (
                            <span className="text-2xl font-black text-[#2563eb] leading-none">{filteredJobsCount}</span>
                          )}

                          <JobsRangeDropdown value={jobsRange} onChange={setJobsRange} />

                          <button
                            type="button"
                            onClick={handleViewJobs}
                            className="text-xs font-bold text-[#2563eb] hover:text-blue-700 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ml-1 transition-colors hover:underline"
                          >
                            <span>View Jobs</span>
                            <span className="text-sm font-bold">→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SECTION 1: BUSINESS INFORMATION */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <span>Business Information</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-12 text-xs pl-8">
                  {/* Left Column */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Client Name</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{clientName}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Business Name</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{companyName}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Business Email</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.email || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Login Email</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">
                        {client.login_email || <span className="text-slate-400 font-medium italic">Not linked</span>}
                      </span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Phone Number</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.contact_number || '—'}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">Business Address</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{client.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">City</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{city || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                      <span className="text-slate-900 font-medium">State / Province</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">{state || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[128px_12px_1fr] gap-x-2 items-center">
                      <span className="text-slate-900 font-medium">Country</span>
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
                      <span className="text-slate-900 font-medium">ZIP / Postal Code</span>
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
                    <span className="text-slate-900 font-medium">Currency</span>
                    <span className="font-semibold text-slate-900">:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(client.currency)}</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="grid grid-cols-[145px_16px_1fr] items-center">
                      <span className="text-slate-900 font-medium">Payment Mode</span>
                      <span className="font-semibold text-slate-900">:</span>
                      <span className="font-semibold text-slate-900">
                        {formatPaymentMode(client.payment_mode)}
                      </span>
                    </div>
                    {cardOnFile ? (
                      <div className="rounded-[8px] border border-slate-200/90 bg-white p-3 shadow-2xs space-y-2 text-xs w-full max-w-[280px]">
                        <div className="grid grid-cols-[145px_16px_1fr] items-center">
                          <span className="text-slate-700 font-medium">Card Last Four Digits</span>
                          <span className="font-semibold text-slate-700">:</span>
                          <span className="font-semibold text-slate-900">{cardOnFile.last4}</span>
                        </div>
                        <div className="grid grid-cols-[145px_16px_1fr] items-center">
                          <span className="text-slate-700 font-medium">Card Expiry Date</span>
                          <span className="font-semibold text-slate-700">:</span>
                          <span className="font-semibold text-slate-900">{cardExpiry}</span>
                        </div>
                      </div>
                    ) : paymentDetailFields.length > 0 ? (
                      <div className="rounded-[8px] border border-slate-200/90 bg-white p-3 shadow-2xs space-y-2 text-xs w-full max-w-[280px]">
                        {paymentDetailFields.map((f) => (
                          <div key={f.label} className="grid grid-cols-[145px_16px_1fr] items-center">
                            <span className="text-slate-700 font-medium">{f.label}</span>
                            <span className="font-semibold text-slate-700">:</span>
                            <span className="font-semibold text-slate-900">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">No payment details on file</div>
                    )}
                  </div>

                  <div className="grid grid-cols-[100px_12px_1fr] gap-x-2">
                    <span className="text-slate-900 font-medium">Payment Terms</span>
                    <span className="font-semibold text-slate-900">:</span>
                    <span className="font-semibold text-slate-900">{formatPaymentTerms(client.payment_terms)}</span>
                  </div>
                </div>
              </div>

              {/* 4. SECTION 3: ACCOUNTING INFORMATION */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </span>
                  <span>Accounting Information</span>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-6 text-xs pt-1 w-full">
                  {/* Left Box: Accounting Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-medium whitespace-nowrap">Accounting Status</span>
                    <span className="font-semibold text-slate-900">:</span>
                    <AccountingStatusDropdown
                      value={currentAccountingStatus as 'hotlisted' | 'send_cc_form' | 'others'}
                      disabled={setAccountingStatus.isPending || setClientHotlisted.isPending || sendCcForm.isPending}
                      onChange={handleAccountingStatusChange}
                    />
                  </div>

                  {/* Right Box: Accounting Notes */}
                  <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <span className="text-slate-900 font-medium whitespace-nowrap">Accounting Notes</span>
                    <span className="font-semibold text-slate-900">:</span>

                    {isEditingNotes ? (
                      <div className="flex items-start gap-1.5 flex-1 min-h-[46px] max-h-[70px]">
                        <textarea
                          placeholder="Add accounting notes..."
                          value={accountingNotes}
                          onChange={(e) => setAccountingNotes(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveAccountingNotes();
                            } else if (e.key === 'Escape') {
                              handleCancelNotes();
                            }
                          }}
                          autoFocus
                          rows={2}
                          className="flex-1 min-h-[46px] max-h-[70px] bg-white border border-slate-300 rounded-[6px] px-3 py-1.5 text-[11.5px] text-slate-800 font-medium placeholder-slate-400 outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/30 transition shadow-2xs resize-none overflow-y-auto leading-snug"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleSaveAccountingNotes}
                            title="Save note"
                            className="w-6 h-6 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelNotes}
                            title="Cancel"
                            className="w-6 h-6 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className="flex-1 min-h-[36px] max-h-[46px] bg-slate-50 border border-slate-200/90 rounded-[6px] px-3 py-1.5 text-[11.5px] font-medium shadow-2xs overflow-y-auto">
                          <div className={client?.accounting_notes ? 'text-slate-800 break-words whitespace-pre-wrap leading-snug' : 'text-slate-400 italic font-normal'}>
                            {client?.accounting_notes || 'No accounting notes added.'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingNotes(true)}
                          title="Edit note"
                          className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-500 hover:text-[#e11d48] flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. SECTIONS 4-7: DEFAULT INSTRUCTION, INTERNAL NOTES, ADDITIONAL INFORMATION, SYSTEM INFORMATION */}
              <div className="pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 relative">
                  {/* Vertical Center Divider Line */}
                  <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-100 pointer-events-none" />

                  {/* Top Left: Default Instruction */}
                  <div className="md:pr-6 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                        <span>Default Instruction</span>
                      </div>
                      {!isEditingInstruction && (
                        <button
                          type="button"
                          onClick={() => setIsEditingInstruction(true)}
                          title="Edit instruction"
                          className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-[#e11d48] flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingInstruction ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Add default instruction..."
                          value={defaultInstruction}
                          onChange={(e) => setDefaultInstruction(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveDefaultInstruction();
                            } else if (e.key === 'Escape') {
                              handleCancelDefaultInstruction();
                            }
                          }}
                          autoFocus
                          rows={3}
                          className="w-full min-h-[64px] max-h-[100px] bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium placeholder-slate-400 outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/30 transition shadow-2xs resize-none overflow-y-auto leading-relaxed"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelDefaultInstruction}
                            className="px-2.5 py-1 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDefaultInstruction}
                            className="px-2.5 py-1 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#f4f7fb] border border-slate-200/90 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 min-h-[64px] max-h-[78px] overflow-y-auto shadow-2xs break-words whitespace-pre-wrap">
                        {client.default_instruction || DEFAULT_INSTRUCTION_PLACEHOLDER}
                      </div>
                    )}
                  </div>

                  {/* Top Right: Internal Notes */}
                  <div className="md:pl-6 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                          <StickyNote className="w-3.5 h-3.5" />
                        </span>
                        <span>Internal Notes</span>
                      </div>
                      {!isEditingInternalNotes && (
                        <button
                          type="button"
                          onClick={() => setIsEditingInternalNotes(true)}
                          title="Edit internal notes"
                          className="w-7 h-7 rounded-[6px] border border-amber-200/90 bg-white hover:bg-amber-50 text-slate-500 hover:text-[#e11d48] flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingInternalNotes ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Add internal notes..."
                          value={internalNotesText}
                          onChange={(e) => setInternalNotesText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveInternalNotes();
                            } else if (e.key === 'Escape') {
                              handleCancelInternalNotes();
                            }
                          }}
                          autoFocus
                          rows={3}
                          className="w-full min-h-[64px] max-h-[100px] bg-white border border-amber-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium placeholder-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition shadow-2xs resize-none overflow-y-auto leading-relaxed"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelInternalNotes}
                            className="px-2.5 py-1 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveInternalNotes}
                            className="px-2.5 py-1 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#fff9eb] border border-[#fde68a] px-3.5 py-2.5 text-xs text-slate-800 space-y-1.5 shadow-2xs min-h-[64px] max-h-[78px] overflow-y-auto">
                        <div className="leading-relaxed break-words whitespace-pre-wrap">
                          <p>{client.internal_notes || INTERNAL_NOTES_PLACEHOLDER}</p>
                        </div>
                        <div className="text-[11px] text-slate-600 space-y-0.5 mt-1.5 border-t border-amber-200/50 pt-1.5">
                          <div>Added by: <span className="font-semibold text-slate-900">{lastUpdatedBy}</span></div>
                          <div>On: <span className="font-semibold text-slate-900">{formatFullDateTime(client.updated_at || client.created_at)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Horizontal Center Divider Line */}
                  <div className="col-span-1 md:col-span-2 border-t border-slate-100 my-0" />

                  {/* Bottom Left: Additional Information */}
                  <div className="md:pr-6 pt-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <span className="w-6 h-6 rounded-[5px] bg-[#fff0f3] border border-[#e11d48]/40 text-[#e11d48] flex items-center justify-center shrink-0 shadow-2xs">
                          <Info className="w-3.5 h-3.5" />
                        </span>
                        <span>Additional Information</span>
                      </div>
                      {!isEditingAdditionalInfo && (
                        <button
                          type="button"
                          onClick={() => setIsEditingAdditionalInfo(true)}
                          title="Edit additional information"
                          className="w-7 h-7 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-[#e11d48] flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isEditingAdditionalInfo ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Notes</label>
                          <input
                            type="text"
                            placeholder="Enter notes..."
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAdditionalInfo();
                              if (e.key === 'Escape') handleCancelAdditionalInfo();
                            }}
                            autoFocus
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#e11d48] shadow-2xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Additional Info</label>
                          <input
                            type="text"
                            placeholder="Enter additional info..."
                            value={additionalInfoText}
                            onChange={(e) => setAdditionalInfoText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAdditionalInfo();
                              if (e.key === 'Escape') handleCancelAdditionalInfo();
                            }}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#e11d48] shadow-2xs"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelAdditionalInfo}
                            className="px-2.5 py-1 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveAdditionalInfo}
                            className="px-2.5 py-1 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs pt-0.5">
                        <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                          <span className="text-slate-500 font-medium">Notes</span>
                          <span className="font-semibold text-slate-900">:</span>
                          <span className="font-semibold text-slate-900">{client.notes || NOTES_PLACEHOLDER}</span>
                        </div>
                        <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                          <span className="text-slate-500 font-medium">Additional Info</span>
                          <span className="font-semibold text-slate-900">:</span>
                          <span className="font-semibold text-slate-900">{client.additional_info || '—'}</span>
                        </div>
                        {client.approval_status === 'REJECTED' && client.rejection_note && (
                          <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                            <span className="text-slate-500 font-medium">Rejection Note</span>
                            <span className="font-semibold text-slate-900">:</span>
                            <span className="font-semibold text-slate-900">{client.rejection_note}</span>
                          </div>
                        )}
                      </div>
                    )}
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
                        <span className="font-semibold text-slate-900">{createdByLabel}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Last Updated On</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{formatFullDateTime(client.updated_at)}</span>
                      </div>
                      <div className="grid grid-cols-[128px_12px_1fr] gap-x-2">
                        <span className="text-slate-500 font-medium">Last Updated By</span>
                        <span className="font-semibold text-slate-900">:</span>
                        <span className="font-semibold text-slate-900">{lastUpdatedBy}</span>
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] border border-blue-200 bg-[#f0f7ff] hover:bg-blue-100/80 text-[#2563eb] font-semibold text-xs shadow-2xs transition cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#2563eb]" />
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
