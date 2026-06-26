import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { X, Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@lib/utils';
import { DesignComplexity, FinalFileFormat, OrderType, Placement, Priority, ProcessType } from '@contracts';
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

// ── Service type data (mirrors ClientBriefForm) ──────────────────────────────

const SPECIFIC_SERVICES: Record<string, string[]> = {
  artwork: [
    'Vector Artwork',
    'Product / Virtual Mock Ups',
    'Cut Contour',
    'Color Separation',
    'Creative Designs',
    'Line Art Conversions',
    'Image Rendering',
    'Color Correction',
    'Brochure Designing',
    'Clipping Path',
    'Channel Mask',
    'Business Card Designs',
    'Packaging Designs',
    'Product Branding',
    'Image Manipulation',
    'Black & White To Color',
  ],
  digitizing: ['Embroidery Digitizing', 'Embroidery Digitizing - Sewout Swatches'],
  others: [],
};

const PLACEMENT_OPTIONS: { label: string; value: Placement }[] = [
  { label: 'Cap',          value: Placement.CAP },
  { label: 'Front of Cap', value: Placement.FRONT_OF_CAP },
  { label: 'Back of Cap',  value: Placement.BACK_OF_CAP },
  { label: 'Side of Cap',  value: Placement.SIDE_OF_CAP },
  { label: 'Visor',        value: Placement.VISOR },
  { label: 'Beanie Cap',   value: Placement.BEANIE_CAP },
  { label: 'Towel',        value: Placement.TOWEL },
  { label: 'Bags',         value: Placement.BAGS },
  { label: 'Left Chest',   value: Placement.LEFT_CHEST },
  { label: 'Sleeve',       value: Placement.SLEEVE },
  { label: 'Pocket',       value: Placement.POCKET },
  { label: 'Full Back',    value: Placement.FULL_BACK },
  { label: 'Full Front',   value: Placement.FULL_FRONT },
  { label: 'Back Yoke',    value: Placement.BACK_YOKE },
  { label: 'Other',        value: Placement.OTHER },
];

// Display string from adapter → Placement enum value
const PLACEMENT_DISPLAY_TO_ENUM: Record<string, Placement> = {
  Cap:           Placement.CAP,
  'Front of Cap': Placement.FRONT_OF_CAP,
  'Back of Cap':  Placement.BACK_OF_CAP,
  'Side of Cap':  Placement.SIDE_OF_CAP,
  Visor:          Placement.VISOR,
  'Beanie Cap':   Placement.BEANIE_CAP,
  Towel:          Placement.TOWEL,
  Bags:           Placement.BAGS,
  'Left Chest':   Placement.LEFT_CHEST,
  Sleeve:         Placement.SLEEVE,
  Pocket:         Placement.POCKET,
  'Full Back':    Placement.FULL_BACK,
  'Full Front':   Placement.FULL_FRONT,
  'Back Yoke':    Placement.BACK_YOKE,
  Other:          Placement.OTHER,
};

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

// ORDER_OPTIONS kept for future use if order-type editing is re-enabled.
// const ORDER_OPTIONS: JobOrderType[] = ['Artwork', 'Digitizing', 'Digitizing + Sewout', 'Sewout'];
const PROCESS_OPTIONS = ['Screen Printing', 'Digital Printing', 'Offset Printing', 'Sublimation', 'Flex Printing', 'Others'];
const COMPLEXITY_OPTIONS: JobComplexity[] = ['Simple', 'Medium', 'Super Medium', 'Complex', 'Super Complex'];
const PRIORITY_OPTIONS: JobPriority[] = ['Normal', 'Rush', 'Super Rush'];
const STATUS_OPTIONS: JobStatus[] = ['Quote Submitted', 'In Production', 'Senior Review', 'Sewout', 'In QC', 'Delivered'];

// ── Helper: map JobOrderType → client-form order id ─────────────────────────
function getOrderTypeId(order: string): string {
  if (order === 'Artwork') return 'artwork';
  if (order === 'Digitizing' || order === 'Digitizing + Sewout' || order === 'Sewout') return 'digitizing';
  return 'others';
}

// ── Helper: derive the "selected service" from order + specific type ─────────
function deriveSelectedService(orderTypeId: string, specificType: string, order: string): string {
  if (orderTypeId === 'others') return 'Others';
  if (orderTypeId === 'digitizing') {
    if (specificType === 'Embroidery Digitizing - Sewout Swatches') return 'Digitizing Sewout';
    if (order === 'Digitizing + Sewout' || order === 'Sewout') return 'Digitizing Sewout';
    return 'Digitizing';
  }
  if (orderTypeId === 'artwork') {
    switch (specificType) {
      case 'Vector Artwork':
      case 'Color Separation':
      case 'Cut Contour':
      case 'Line Art Conversions':
        return 'Vector Artwork';
      case 'Creative Designs':
      case 'Product Branding':
        return 'Logo Designing';
      case 'Product / Virtual Mock Ups':
      case 'Image Rendering':
      case 'Color Correction':
      case 'Clipping Path':
      case 'Channel Mask':
      case 'Image Manipulation':
      case 'Black & White To Color':
        return 'Virtual Proof';
      case 'Business Card Designs':
        return 'Business Card';
      case 'Brochure Designing':
        return 'Brouchers';
      case 'Packaging Designs':
        return 'Carton Box Designing';
      default:
        return 'Vector Artwork';
    }
  }
  return '';
}

// ── Helper: format options for a derived service ─────────────────────────────
function getFormatOptions(selectedService: string): string[] {
  switch (selectedService) {
    case 'Vector Artwork':
    case 'Business Card':
    case 'Brouchers':
    case 'Logo Designing':
    case 'Carton Box Designing':
    case 'Others':
      return ['PDF, EPS', 'PDF, AI', 'PDF, EPS, AI', 'PDF, CDR', 'PDF, EPS, CDR', 'PDF, EPS, AI, CDR', 'OTHERS'];
    case 'Digitizing':
    case 'Digitizing Sewout':
      return ['PDF, DST', 'DST, PDF, EMB', 'DST, PDF, PXF', 'DST, PDF, CND, EXP', 'DST, PDF, CND, EXP, EMB', 'OTHERS'];
    case 'Virtual Proof':
      return ['JPEG', 'SVG', 'PDF', 'TIFF', 'OTHERS'];
    default:
      return [];
  }
}

// ── Helper: format option string → FinalFileFormat[] ────────────────────────
function parseFinalFiles(option: string): FinalFileFormat[] {
  if (!option || option === 'OTHERS') return [FinalFileFormat.OTHERS];
  return option.split(',').map((s) => s.trim()).map((part) => {
    if (part === 'PDF') return FinalFileFormat.PDF;
    if (part === 'EPS') return FinalFileFormat.EPS;
    if (part === 'AI') return FinalFileFormat.AI;
    if (part === 'CDR') return FinalFileFormat.CDR;
    return FinalFileFormat.OTHERS;
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface EditJobModalProps {
  job: Job | null;
  onClose: () => void;
  onBack?: (job: Job) => void;
  onSave?: (job: Job, changes: EditFields) => void;
}

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
  specificType?: string | null;
  finalFiles?: string[];
  fabric?: string;
  placement?: string;
  widthInches?: number | null;
  heightInches?: number | null;
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
  specificType: string;
  formatOption: string;
  fabric: string;
  placement: string; // Placement enum value
  widthInches: string;
  heightInches: string;
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
    specificType: job.specificType ?? '',
    // Try to match stored finalFiles against a format option string.
    // e.g. ['PDF','EPS'] → 'PDF, EPS' (matches artwork option).
    // Digitizing formats stored as OTHERS won't match; user re-selects.
    formatOption: (job.finalFiles ?? []).join(', '),
    fabric: job.fabric ?? '',
    placement: job.placement ? (PLACEMENT_DISPLAY_TO_ENUM[job.placement] ?? '') : '',
    widthInches: job.width != null ? String(job.width) : '',
    heightInches: job.height != null ? String(job.height) : '',
  };
}

// ── Pricing helpers ──────────────────────────────────────────────────────────

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

const FIELD_READONLY_CLS =
  'w-full rounded-lg px-3 py-2.5 text-[12.5px] border bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] cursor-not-allowed select-none';

type PriceCell = string | { text: string; muted?: boolean; warn?: boolean };

function formatMoney(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (!Number.isFinite(n)) return String(raw);
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

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
  if (agreedPrice && parseFloat(agreedPrice) > 0) return formatMoney(agreedPrice);
  if (hasClientAccepted(job)) {
    return adminPrice && parseFloat(adminPrice) > 0
      ? formatMoney(adminPrice)
      : { text: '—', muted: true };
  }
  if (adminPrice) return { text: 'Waiting for client acceptance', warn: true };
  return { text: 'Pending — price not sent', muted: true };
}

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
      style={{ background: '#F8FAFC', border: '1px solid #E8EDF5', padding: '10px 14px' }}
    >
      <span className="text-[12px]" style={{ color: '#64748B', fontWeight: 500 }}>{label}</span>
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

// ── Component ────────────────────────────────────────────────────────────────

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

  // Derived service-type state from the form
  const orderTypeId = useMemo(() => getOrderTypeId(form?.order ?? ''), [form?.order]);
  const specificServices = useMemo(() => SPECIFIC_SERVICES[orderTypeId] ?? [], [orderTypeId]);
  const derivedService = useMemo(
    () => deriveSelectedService(orderTypeId, form?.specificType ?? '', form?.order ?? ''),
    [orderTypeId, form?.specificType, form?.order],
  );
  const formatOptions = useMemo(() => getFormatOptions(derivedService), [derivedService]);

  const isDigitizing = orderTypeId === 'digitizing';

  if (!job || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const num = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  // These handlers are preserved in case order/service editing is re-enabled.
  // const handleOrderChange = ...
  // const handleSpecificTypeChange = ...

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

    const colors = num(form.colors);
    if (colors != null && colors >= 0 && colors !== job.colors) patch.num_colors = colors;

    if (form.notes !== (job.notes ?? '')) patch.notes = form.notes;

    // Specific service
    if (form.specificType !== (job.specificType ?? '')) {
      patch.specific_type = form.specificType || undefined;
    }

    // Output formats: compare normalized arrays
    if (form.formatOption) {
      const newFiles = parseFinalFiles(form.formatOption);
      const newStr = [...newFiles].sort().join(',');
      const oldStr = [...(job.finalFiles ?? [])].sort().join(',');
      if (newStr !== oldStr) patch.final_files = newFiles;
    }

    // Fabric
    if (form.fabric !== (job.fabric ?? '')) {
      patch.fabric = form.fabric || undefined;
    }

    // Placement: form stores enum value; job.placement is display string
    const origPlacementEnum = job.placement ? (PLACEMENT_DISPLAY_TO_ENUM[job.placement] ?? '') : '';
    if (form.placement !== origPlacementEnum) {
      patch.placement = form.placement || undefined;
    }

    // Width / Height
    const wi = num(form.widthInches);
    if (wi != null && wi > 0 && wi !== (job.width ?? null)) patch.width_inches = wi;

    const hi = num(form.heightInches);
    if (hi != null && hi > 0 && hi !== (job.height ?? null)) patch.height_inches = hi;

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
        etaHours: job.etaHours ?? null,
        colors: num(form.colors),
        clientPrice: num(form.clientPrice),
        adminPrice: num(form.adminPrice),
        agreedPrice: num(form.agreedPrice),
        notes: form.notes,
        specificType: form.specificType || null,
        finalFiles: form.formatOption ? parseFinalFiles(form.formatOption) : [],
        fabric: form.fabric,
        placement: form.placement,
        widthInches: num(form.widthInches),
        heightInches: num(form.heightInches),
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

  const hasChanges = form ? Object.keys(buildPatch()).length > 0 : false;

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
        className="relative w-full max-w-[720px] max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
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

            {/* ── LEFT: JOB INFORMATION ── */}
            <div>
              <SectionLabel>JOB INFORMATION</SectionLabel>
              <div className="grid gap-3">

                <Field label="Design Name">
                  <input className={FIELD_READONLY_CLS} value={form.design} readOnly tabIndex={-1} />
                </Field>

                <Field label="Order Type">
                  <input className={FIELD_READONLY_CLS} value={form.order} readOnly tabIndex={-1} />
                </Field>

                {/* Specific Service — read-only display */}
                {specificServices.length > 0 && (
                  <Field label="Specific Service">
                    <input
                      className={FIELD_READONLY_CLS}
                      value={form.specificType || '—'}
                      readOnly
                      tabIndex={-1}
                    />
                  </Field>
                )}

                {/* Output Formats — chips, options depend on derived service */}
                {formatOptions.length > 0 && (
                  <Field label="Output Formats">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {formatOptions.map((opt) => {
                        const active = form.formatOption === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => set('formatOption', active ? '' : opt)}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide transition select-none cursor-pointer',
                              active ? 'text-white' : 'text-[#64748B] hover:text-[#0D1B2A]',
                            )}
                            style={{
                              border: `1.5px solid ${active ? '#B22234' : '#E2E8F0'}`,
                              background: active ? '#B22234' : '#fff',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {/* Process Type — only for services that use a printing process (mirrors client form) */}
                {(derivedService === 'Vector Artwork' || derivedService === 'Business Card' || derivedService === 'Brouchers' || derivedService === 'Logo Designing' || derivedService === 'Carton Box Designing') && (
                  <Field label="Process Type">
                    <select className={FIELD_CLS} value={form.process} onChange={(e) => set('process', e.target.value)}>
                      <option value="">—</option>
                      {PROCESS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                )}

                {/* Digitizing fields */}
                {isDigitizing && (
                  <>
                    <Field label="Fabric">
                      <input
                        className={FIELD_CLS}
                        value={form.fabric}
                        placeholder="e.g. Cotton, Polyester, Denim"
                        onChange={(e) => set('fabric', e.target.value)}
                      />
                    </Field>

                    <Field label="Placement">
                      <select className={FIELD_CLS} value={form.placement} onChange={(e) => set('placement', e.target.value)}>
                        <option value="">— Select placement —</option>
                        {PLACEMENT_OPTIONS.map(({ label, value }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Width (inches)">
                        <input
                          className={FIELD_CLS}
                          type="number"
                          min={0.1}
                          step="0.1"
                          placeholder="e.g. 3.5"
                          value={form.widthInches}
                          onChange={(e) => set('widthInches', e.target.value)}
                        />
                      </Field>
                      <Field label="Height (inches)">
                        <input
                          className={FIELD_CLS}
                          type="number"
                          min={0.1}
                          step="0.1"
                          placeholder="e.g. 2.5"
                          value={form.heightInches}
                          onChange={(e) => set('heightInches', e.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                )}

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

                <Field label="Number of Colors">
                  <input className={FIELD_CLS} type="number" min={1} max={20} value={form.colors} onChange={(e) => set('colors', e.target.value)} />
                </Field>

              </div>
            </div>

            {/* ── RIGHT: PRICING & NOTES ── */}
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
              opacity: (updateMutation.isPending || createAdminCopyMutation.isPending || !hasChanges) ? 0.55 : 1,
              cursor: (updateMutation.isPending || createAdminCopyMutation.isPending || !hasChanges) ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSave}
            disabled={updateMutation.isPending || createAdminCopyMutation.isPending || !hasChanges}
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
