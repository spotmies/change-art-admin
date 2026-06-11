import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { X, Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@lib/utils';
import { DesignComplexity, OrderType, Priority, ProcessType } from '@contracts';
import { useUpdateJobCard, useCreateAdminCopy } from '@modules/admin-panel/hooks/use-admin-jobs';
import { toastApiError } from '@lib/toast-error';
import type { UpdateJobCardBody } from '@modules/admin-panel/services/admin.service';
import type {
  Job,
  JobComplexity,
  JobOrderType,
  JobPriority,
  JobStatus,
} from '../mocks/jobs';

interface EditJobModalProps {
  job: Job | null;
  onClose: () => void;
  /** "Back" — return to the read-only detail view. */
  onBack?: (job: Job) => void;
  /** Optional side-effect fired AFTER a successful save (the modal persists
   *  the change itself). Receives the original job + the edited values. */
  onSave?: (job: Job, changes: EditFields) => void;
}

// ── Display → backend enum maps (reverse of job-view adapter) ───────────────
const ORDER_TO_ENUM: Record<string, OrderType> = {
  Artwork: OrderType.ARTWORK,
  Digitizing: OrderType.DIGITIZING,
  'Digitizing + Sewout': OrderType.DIGITIZING_SEWOUT,
  Sewout: OrderType.DIGITIZING_SEWOUT,
};
const PROCESS_TO_ENUM: Record<string, ProcessType> = {
  'Screen Printing': ProcessType.SCREEN_PRINTING,
  'Digital Printing': ProcessType.DIGITAL_PRINTING,
  'Offset Printing': ProcessType.OFFSET_PRINTING,
  Sublimation: ProcessType.OTHERS,
  'Flex Printing': ProcessType.OTHERS,
  Others: ProcessType.OTHERS,
  Other: ProcessType.OTHERS,
};
const COMPLEXITY_TO_ENUM: Record<string, DesignComplexity> = {
  Simple: DesignComplexity.SIMPLE,
  Medium: DesignComplexity.MEDIUM,
  'Super Medium': DesignComplexity.SUPER_MEDIUM,
  Complex: DesignComplexity.COMPLEX,
  'Super Complex': DesignComplexity.SUPER_COMPLEX,
};
const PRIORITY_TO_ENUM: Record<string, Priority> = {
  Normal: Priority.NORMAL,
  Rush: Priority.RUSH,
  'Super Rush': Priority.SUPER_RUSH,
};

const ORDER_OPTIONS: JobOrderType[] = ['Artwork', 'Digitizing', 'Digitizing + Sewout', 'Sewout'];
const PROCESS_OPTIONS = ['Screen Printing', 'Digital Printing', 'Offset Printing', 'Sublimation', 'Flex Printing', 'Others'];
const COMPLEXITY_OPTIONS: JobComplexity[] = ['Simple', 'Medium', 'Super Medium', 'Complex', 'Super Complex'];
const PRIORITY_OPTIONS: JobPriority[] = ['Normal', 'Rush', 'Super Rush'];
const STATUS_OPTIONS: JobStatus[] = ['Quote Submitted', 'In Production', 'Senior Review', 'Sewout', 'In QC', 'Delivered'];

export interface EditFields {
  design: string;
  client: string;
  order: JobOrderType;
  process: string;
  complexity: JobComplexity;
  priority: JobPriority;
  status: JobStatus;
  etaHours: number | null;
  colors: number | null;
  clientPrice: number | null;
  adminPrice: number | null;
  agreedPrice: number | null;
  notes: string;
}

interface FormState {
  design: string;
  client: string;
  order: JobOrderType;
  process: string;
  complexity: JobComplexity;
  priority: JobPriority;
  status: JobStatus;
  etaHours: string;
  colors: string;
  clientPrice: string;
  adminPrice: string;
  agreedPrice: string;
  notes: string;
}

function toForm(job: Job): FormState {
  return {
    design: job.design,
    client: job.client,
    order: job.order,
    process: job.process ?? '',
    complexity: job.complexity,
    priority: job.priority,
    status: STATUS_OPTIONS.includes(job.status) ? job.status : 'In Production',
    etaHours: job.etaHours ? String(job.etaHours) : '',
    colors: job.colors ? String(job.colors) : '',
    clientPrice: job.clientPrice != null ? String(job.clientPrice) : '',
    adminPrice: job.adminPrice != null ? String(job.adminPrice) : '',
    agreedPrice: job.agreedPrice != null ? String(job.agreedPrice) : '',
    notes: job.notes ?? '',
  };
}

function priorityClass(priority: string): string {
  const map: Record<string, string> = { Normal: 'normal', Rush: 'rush', 'Super Rush': 'super-rush' };
  return map[priority] ?? 'normal';
}

function orderAccent(order: string): string {
  const map: Record<string, string> = {
    Artwork: 'navy', Digitizing: 'teal',
    'Digitizing + Sewout': 'purple', Sewout: 'purple',
  };
  return map[order] ?? 'gray';
}

function statusAccent(status: string): string {
  const map: Record<string, string> = {
    'In QC': 'teal', 'In Production': 'amber', 'Senior Review': 'purple',
    Sewout: 'purple', Delivered: 'green', 'Quote Submitted': 'blue',
    'Quote Approved': 'amber', 'Pending Client Confirm': 'amber',
    Cancelled: 'gray', Amend: 'amber', 'In Review': 'purple',
  };
  return map[status] ?? 'gray';
}

const FIELD_CLS =
  'w-full rounded-lg px-3 py-2.5 text-[12.5px] outline-none transition border bg-white text-[#0D1B2A] border-[#E2E8F0] focus:border-[#B22234] focus:ring-2 focus:ring-[#B22234]/10';

// ── Pricing display helpers ─────────────────────────────────

type PriceCell = string | { text: string; muted?: boolean; warn?: boolean };

function formatMoney(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (!Number.isFinite(n)) return String(raw);
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Whether the client has accepted the price and the job has moved past the
 * quote-approval stage. After this point, the agency's quoted price is the
 * agreed price — there's no separate negotiated-finalisation step today.
 *
 * Primary check is `stage`: the adapter maps every QUOTE_* status to
 * `'quote'`, so anything else (`junior`, `senior`, `sewout`, `qc`,
 * `delivered`) means the workflow has progressed past the quote handoff
 * and the price is locked in. We fall back to `rawStatus` in case a
 * caller hand-constructed a Job without a stage value.
 */
function hasClientAccepted(job: Job): boolean {
  if (job.stage && job.stage !== 'quote') return true;
  const raw = (job.rawStatus ?? '').toUpperCase().replace(/\s+/g, '_');
  if (!raw) return false;
  return raw !== 'QUOTE_SUBMITTED'
    && raw !== 'QUOTE_APPROVED'
    && raw !== 'QUOTE_REJECTED'
    && raw !== 'DRAFT'
    && raw !== 'CANCELLED';
}

function resolveAgreedPrice(job: Job | null, adminPrice: string, agreedPrice: string): PriceCell {
  if (!job) return { text: '—', muted: true };
  // Explicit final negotiated price wins (only set if the formal quotes module
  // finalised something different from the flat admin_price).
  if (agreedPrice && parseFloat(agreedPrice) > 0) return formatMoney(agreedPrice);
  // Once the client has accepted (status moved past QUOTE_APPROVED), the
  // admin_price IS the agreed price — show it. Never say "waiting" or
  // "pending" once we're past quote stage; if no value is on file (legacy
  // job created before admin_price existed) just show a neutral dash.
  if (hasClientAccepted(job)) {
    return adminPrice && parseFloat(adminPrice) > 0
      ? formatMoney(adminPrice)
      : { text: '—', muted: true };
  }
  // Quote stage: admin sent a price, client hasn't accepted yet.
  if (adminPrice) return { text: 'Waiting for client acceptance', warn: true };
  // Quote stage: no price quoted yet.
  return { text: 'Pending — price not sent', muted: true };
}

/**
 * Resolve the Admin Counter-Offer row. Same idea as agreed-price: once the
 * client has accepted, never imply that no offer was made — the price
 * stored on the job IS the offer that locked the deal.
 */
function resolveAdminOffer(job: Job | null, adminPrice: string): PriceCell {
  if (adminPrice && parseFloat(adminPrice) > 0) return formatMoney(adminPrice);
  if (job && hasClientAccepted(job)) return { text: '—', muted: true };
  return { text: 'Not yet sent', muted: true };
}

function PricingRow({ label, value }: { label: string; value: PriceCell }) {
  const isObj = typeof value !== 'string';
  const text = isObj ? value.text : value;
  const muted = isObj && value.muted;
  const warn  = isObj && value.warn;
  return (
    <div
      className="flex items-center justify-between rounded-lg"
      style={{
        background: '#F8FAFC',
        border: '1px solid #E8EDF5',
        padding: '10px 14px',
      }}
    >
      <span className="text-[12px]" style={{ color: '#64748B', fontWeight: 500 }}>
        {label}
      </span>
      <span
        className="text-[13px]"
        style={{
          color: muted ? '#94A3B8' : warn ? '#B45309' : '#0D1B2A',
          fontWeight: muted ? 500 : 700,
          fontStyle: muted || warn ? 'italic' : 'normal',
          fontFamily: muted || warn ? 'inherit' : 'IBM Plex Mono, monospace',
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function EditJobModal({ job, onClose, onBack, onSave }: EditJobModalProps) {
  const [isIn, setIsIn] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const updateMutation = useUpdateJobCard();
  const createAdminCopyMutation = useCreateAdminCopy();

  useEffect(() => {
    if (job) {
      setForm(toForm(job));
      const raf = requestAnimationFrame(() => setIsIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsIn(false);
    return undefined;
  }, [job]);

  const handleClose = useCallback(() => {
    setIsIn(false);
    const t = setTimeout(() => onClose(), 220);
    return () => clearTimeout(t);
  }, [onClose]);

  useEffect(() => {
    if (!job) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [job]);

  useEffect(() => {
    if (!job) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job, handleClose]);

  if (!job || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const num = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  // Build a minimal PATCH body containing ONLY the fields that actually
  // changed and that this endpoint accepts. Sending unchanged fields would
  // needlessly trip the backend's per-role field RBAC (it rejects the whole
  // request if any single field isn't editable by the caller's role). Status
  // and pricing are intentionally excluded — status is workflow-driven and
  // prices go through the CS quote flow.
  const buildPatch = (): Omit<UpdateJobCardBody, 'version'> => {
    const patch: Omit<UpdateJobCardBody, 'version'> = {};
    const design = form.design.trim();
    if (design && design !== job.design) patch.design_name = design;
    if (form.order !== job.order && ORDER_TO_ENUM[form.order]) {
      patch.order_type = ORDER_TO_ENUM[form.order];
    }
    if (form.process !== (job.process ?? '') && form.process && PROCESS_TO_ENUM[form.process]) {
      patch.process_type = PROCESS_TO_ENUM[form.process];
    }
    if (form.complexity !== job.complexity && COMPLEXITY_TO_ENUM[form.complexity]) {
      patch.design_complexity = COMPLEXITY_TO_ENUM[form.complexity];
    }
    if (form.priority !== job.priority && PRIORITY_TO_ENUM[form.priority]) {
      patch.priority = PRIORITY_TO_ENUM[form.priority];
    }
    const eta = num(form.etaHours);
    if (eta != null && eta > 0 && eta !== job.etaHours) patch.eta_hours = eta;
    const colors = num(form.colors);
    if (colors != null && colors >= 0 && colors !== job.colors) patch.num_colors = colors;
    if (form.notes !== (job.notes ?? '')) patch.notes = form.notes;
    return patch;
  };

  const handleSave = () => {
    const patch = buildPatch();

    if (Object.keys(patch).length === 0) {
      if (form.status !== job.status) {
        toast.error("Status changes happen automatically as the job moves through the workflow — it can't be set here.");
      }
      handleClose();
      return;
    }

    if (!job.uuid) {
      toast.error('This job is missing its backend reference — refresh the page and try again.');
      return;
    }

    const afterSuccess = () => {
      toast.success(job.isAdminCopy ? 'Admin copy updated.' : 'Admin copy created — original client data preserved.');
      onSave?.(job, {
        design: form.design.trim() || job.design,
        client: form.client.trim() || job.client,
        order: form.order,
        process: form.process,
        complexity: form.complexity,
        priority: form.priority,
        status: form.status,
        etaHours: num(form.etaHours),
        colors: num(form.colors),
        clientPrice: num(form.clientPrice),
        adminPrice: num(form.adminPrice),
        agreedPrice: num(form.agreedPrice),
        notes: form.notes,
      });
      handleClose();
    };

    // If this is already an admin copy — patch it normally.
    if (job.isAdminCopy) {
      if (job.version == null) {
        toast.error('Version info missing — refresh and try again.');
        return;
      }
      updateMutation.mutate(
        { id: job.uuid, body: { version: job.version, ...patch } },
        { onSuccess: afterSuccess, onError: (err) => toastApiError(err) },
      );
      return;
    }

    // First-time edit on an original job — create admin copy via dedicated endpoint.
    createAdminCopyMutation.mutate(
      { originalJobId: job.uuid, body: patch },
      { onSuccess: afterSuccess, onError: (err) => toastApiError(err) },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: isIn ? 'rgba(15,23,42,0.45)' : 'rgba(15,23,42,0)',
        backdropFilter: isIn ? 'blur(5px)' : 'blur(0px)',
        WebkitBackdropFilter: isIn ? 'blur(5px)' : 'blur(0px)',
        transition: 'all 240ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit job: ${job.design}`}
        className="relative w-full max-w-[660px] max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          transform: isIn ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.96)',
          opacity: isIn ? 1 : 0,
          transition: 'all 240ms cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #E8EDF5' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-2 mb-1.5"
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 700, color: '#B22234', letterSpacing: '0.04em' }}
              >
                <span>{job.id}</span>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <span>Edit Job</span>
              </div>
              <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: '#0D1B2A' }}>
                {form.design || job.design}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={cn('badge', orderAccent(form.order))}>{form.order}</span>
                <span className={cn('badge', statusAccent(form.status))}>{form.status}</span>
                <span className={cn('badge', job.project === 'Amend' ? 'amber' : 'gray')}>{job.project}</span>
                <span className={cn('priority-badge', priorityClass(form.priority))}>{form.priority}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition"
              style={{ border: '1px solid #E8EDF5', color: '#94A3B8' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: '#fff' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
            {/* JOB INFORMATION */}
            <div>
              <SectionLabel>JOB INFORMATION</SectionLabel>
              <div className="grid gap-3">
                <Field label="Design Name">
                  <input className={FIELD_CLS} value={form.design} onChange={(e) => set('design', e.target.value)} />
                </Field>
                <Field label="Client">
                  <input className={FIELD_CLS} value={form.client} onChange={(e) => set('client', e.target.value)} />
                </Field>
                <Field label="Order Type">
                  <select className={FIELD_CLS} value={form.order} onChange={(e) => set('order', e.target.value as JobOrderType)}>
                    {ORDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Process Type">
                  <select className={FIELD_CLS} value={form.process} onChange={(e) => set('process', e.target.value)}>
                    <option value="">—</option>
                    {PROCESS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Complexity">
                  <select className={FIELD_CLS} value={form.complexity} onChange={(e) => set('complexity', e.target.value as JobComplexity)}>
                    {COMPLEXITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={FIELD_CLS} value={form.priority} onChange={(e) => set('priority', e.target.value as JobPriority)}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={FIELD_CLS} value={form.status} onChange={(e) => set('status', e.target.value as JobStatus)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="ETA (hours)">
                  <input className={FIELD_CLS} type="number" min={1} value={form.etaHours} onChange={(e) => set('etaHours', e.target.value)} />
                </Field>
                <Field label="Number of Colors">
                  <input className={FIELD_CLS} type="number" min={1} max={12} value={form.colors} onChange={(e) => set('colors', e.target.value)} />
                </Field>
              </div>
            </div>

            {/* PRICING — set via the dedicated quote flow. Display is
                status-aware: until the client accepts the price, the agreed
                row shows "Waiting for client acceptance"; once they place
                the job, it shows the locked-in amount. */}
            <div>
              <SectionLabel>PRICING &amp; NOTES</SectionLabel>
              <div className="grid gap-2 mb-4">
                <PricingRow
                  label="Client Budget ($)"
                  value={
                    form.clientPrice
                      ? formatMoney(form.clientPrice)
                      : { text: 'Not provided', muted: true }
                  }
                />
                <PricingRow
                  label={job && hasClientAccepted(job) ? 'Quoted Price ($)' : 'Admin Counter-Offer ($)'}
                  value={resolveAdminOffer(job, form.adminPrice)}
                />
                <PricingRow
                  label={job && hasClientAccepted(job) ? 'Final Price ($)' : 'Agreed / Final Price ($)'}
                  value={resolveAgreedPrice(job, form.adminPrice, form.agreedPrice)}
                />
              </div>
              <Field label="Notes / Brief">
                <textarea
                  className={cn(FIELD_CLS, 'resize-y')}
                  style={{ minHeight: 130 }}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-6 py-3.5"
          style={{ borderTop: '1px solid #E8EDF5', background: '#FAFBFD' }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
            onClick={() => (onBack ? onBack(job) : handleClose())}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Back
          </button>
          <button
            type="button"
            className="btn btn-crimson"
            style={{
              fontSize: 12,
              padding: '7px 13px',
              gap: 6,
              marginLeft: 'auto',
              opacity: (updateMutation.isPending || createAdminCopyMutation.isPending) ? 0.6 : 1,
              cursor: (updateMutation.isPending || createAdminCopyMutation.isPending) ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSave}
            disabled={updateMutation.isPending || createAdminCopyMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" aria-hidden />
            {(updateMutation.isPending || createAdminCopyMutation.isPending) ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="text-[10px] font-bold uppercase tracking-[0.14em] whitespace-nowrap shrink-0"
        style={{ color: '#94A3B8' }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: '#E8EDF5' }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: '#94A3B8' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
