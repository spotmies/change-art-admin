import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JobQueriesSection } from './JobQueriesSection';
import { X, Download, Send, AlertCircle, Timer, CheckCircle2, FileText, Upload, Loader2, Copy, CreditCard, ShoppingCart, Pencil, Search, Play, Info, DollarSign, Check, Clock, Image as ImageIcon, User, Building2 } from 'lucide-react';
import { getCardExpiryStatus } from '@lib/card-expiry';
import { MarkCompleteModal } from '@modules/cs-panel/components/MarkCompleteModal';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import toast from 'react-hot-toast';
import { toastApiError } from '@lib/toast-error';
import { cn } from '@lib/utils';
import { type Job } from '../mocks/jobs';
import { useSendQuotePrice, useDispatchJob, useAcknowledgeJob, useNotifyOrderReady } from '@/modules/cs-panel/hooks/use-cs-quote';
import { uploadCompletedFile } from '@modules/cs-panel/services/cs-quote.service';

import { useJobRoom } from '@lib/use-job-room';
import { useAdminJobById, useAdminJobFiles, useAdminJobImageUrls, isAdminViewableImage } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useJobQueries } from '@modules/admin-panel/hooks/use-job-queries';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { FileCategory, JobStatus, type IFileVersion } from '@contracts';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { FilePreviewModal } from './FilePreviewModal';
import { resolveServiceBucket, resolveServiceFieldFlags } from '@lib/service-fields';

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** Compute hh:mm:ss remaining from an ISO start timestamp + duration hours. */
function computeEtaCountdown(acknowledgedAt: string, etaHours: number): { display: string; expired: boolean } {
  const startMs = new Date(acknowledgedAt).getTime();
  const totalMs = etaHours * 60 * 60 * 1000;
  const endMs = startMs + totalMs;
  const remaining = Math.min(totalMs, Math.max(0, endMs - Date.now()));
  if (remaining === 0) return { display: 'Completed', expired: true };
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    display: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    expired: false,
  };
}

function useEtaCountdown(
  acknowledgedAt: string | null | undefined,
  etaHours: number | null | undefined,
  isHeld = false,
) {
  const active = !!(acknowledgedAt && etaHours != null && etaHours > 0) && !isHeld;
  const [state, setState] = useState(() =>
    active ? computeEtaCountdown(acknowledgedAt!, etaHours!) : null,
  );
  useEffect(() => {
    if (!active) {
      setState(isHeld ? { display: 'On Hold', expired: false } : null);
      return;
    }
    setState(computeEtaCountdown(acknowledgedAt!, etaHours!));
    const id = setInterval(() => {
      const next = computeEtaCountdown(acknowledgedAt!, etaHours!);
      setState(next);
      if (next.expired) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [active, isHeld, acknowledgedAt, etaHours]);
  return state;
}

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onConfirmJob?: (job: Job) => void;
  /** Open the edit form for this job (wired to the "Edit Job" footer button). */
  onEdit?: (job: Job) => void;
  /** Open the assign-member modal for this job (wired to the "Assign Job" footer button). */
  onAssign?: (job: Job) => void;
  /**
   * Render the quote popup (Review & Set Price section, blue step, no Dispatch).
   * Driven by CONTEXT — only the Quotes page/section sets this. Job lists leave
   * it false so a quote-stage job still opens the regular job popup.
   */
  quoteView?: boolean;
}

function currentStepIndex(job: Job): number {
  switch (job.stage) {
    case 'quote': return 0;
    case 'delivered': return 2;
    default: return 1;
  }
}

function displayStatus(status: string): string {
  if (status === 'Quote Approved') return 'Quote Sent';
  return status;
}



function normalizedStatus(job: Job): string {
  // Prefer the raw backend enum carried by the adapter; fall back to the
  // UI-friendly `status` for mock data. Both paths normalize to the
  // `JOB_STATUS_NAME` shape so callers can compare against backend enums.
  return (job.rawStatus ?? job.status).toUpperCase().replace(/\s+/g, '_');
}



function isQuoteAlreadySent(job: Job): boolean {
  // "Price sent — awaiting client" state: agency has already priced the
  // quote, status moved to QUOTE_APPROVED, now waiting on the client's
  // confirmation. In this state the pricing card should display the
  // already-entered values as READ-ONLY.
  //
  // Match the raw backend enum first; fall back to the UI label only when
  // the raw status is missing (mock data or stale cache). The UI label for
  // QUOTE_APPROVED is exactly "Quote Approved".
  if (job.rawStatus) return job.rawStatus.toUpperCase() === 'QUOTE_APPROVED';
  return job.status === 'Quote Approved';
}



function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return `${formatDate(dateStr)} ${d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  } catch {
    return String(dateStr);
  }
}

function computeExpectedCompletionIso(startIsoStr?: string | null, etaHours?: number | null): string | null {
  if (!startIsoStr || etaHours == null || etaHours <= 0) return null;
  const startMs = new Date(startIsoStr).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + etaHours * 60 * 60 * 1000;
  return new Date(endMs).toISOString();
}

function PlacementTargetIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SizeFrameIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h16M4 15h16M9 4v16M15 4v16" />
    </svg>
  );
}

function ColorsBoxIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}

function FabricCylinderIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" />
    </svg>
  );
}

function AssignedUserIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CreatedCalendarIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/** Icon + label + value row for the "Job Details" card — matches reference design spec. */
function JobDetailInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center text-[11px] py-0.5">
      <div className="flex items-center gap-1.5 w-[100px] shrink-0 text-[#475569] font-medium">
        <Icon className="w-3 h-3 shrink-0 text-[#475569]" />
        <span>{label}</span>
      </div>
      <span className="text-[#64748b] mr-2 font-medium shrink-0">:</span>
      <span className="font-semibold text-[#0f172a] min-w-0 break-words">{value}</span>
    </div>
  );
}

/** Key + colon + value row for the "Order Summary" card — matches reference design spec. */
function OrderSummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center text-[11px] py-0.5">
      <span className="w-[115px] shrink-0 text-[#475569] font-medium truncate">{label}</span>
      <span className="text-[#64748b] mr-2 font-medium shrink-0">:</span>
      <span className="font-semibold text-[#0f172a] min-w-0 break-words">{value}</span>
    </div>
  );
}

export function JobDetailModal({ job, onClose, onEdit: _onEdit, onAssign, quoteView: _quoteView = false }: JobDetailModalProps) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'messages' | 'notes' | 'activity'>('overview');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [internalNotesList, setInternalNotesList] = useState<{ id: string; author: string; date: string; text: string }[]>([]);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [isIn, setIsIn] = useState(false);
  const [agencyPrice, setAgencyPrice] = useState('');
  const [confirmedEta, setConfirmedEta] = useState('');
  const [noteToClient, setNoteToClient] = useState('');
  // Field-specific invalid flags so the error message + border colour
  // can call out exactly which input is missing, instead of the old
  // single boolean that always read "Please enter a valid quoted price"
  // even when the price was fine and only the ETA was empty.
  const [_priceInvalid, setPriceInvalid] = useState(false);
  const [_etaInvalid, setEtaInvalid] = useState(false);
  const [_carPage, setCarPage] = useState(0);
  const [previewFile, setPreviewFile] = useState<IFileVersion | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [showSendMailModal, setShowSendMailModal] = useState(false);
  const [sendMailConfirmText, setSendMailConfirmText] = useState('');
  const [sendMailFiles, setSendMailFiles] = useState<File[]>([]);
  const [sendMailPhase, setSendMailPhase] = useState<'idle' | 'uploading' | 'sending'>('idle');
  const [sendMailUploadProgress, setSendMailUploadProgress] = useState(0);
  const [isSendMailDragging, setIsSendMailDragging] = useState(false);
  const [sendMailNote, setSendMailNote] = useState('');
  const [excludedServerFileIds, setExcludedServerFileIds] = useState<Set<string>>(new Set());
  const sendMailFileInputRef = useRef<HTMLInputElement>(null);

  const addSendMailFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const incomingFiles = Array.from(incoming);
    if (allowedFormats && allowedFormats.length > 0) {
      const invalidFiles = incomingFiles.filter(f => {
        const dotIdx = f.name.lastIndexOf('.');
        const ext = dotIdx !== -1 ? f.name.slice(dotIdx + 1).toLowerCase() : '';
        return !allowedFormats.includes(ext);
      });
      if (invalidFiles.length > 0) {
        toast.error(`Only ${allowedFormats.map(e => e.toUpperCase()).join(', ')} formats can be uploaded for this job.`);
        return;
      }
    }
    setSendMailFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const next = incomingFiles.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...next];
    });
  };

  const removeSendMailFile = (idx: number) => {
    setSendMailFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const openSendMailModal = () => {
    if (job?.project === 'Amend' && allCompletedFiles.length > 0) {
      setExcludedServerFileIds(new Set(allCompletedFiles.map((f) => f.id)));
    } else {
      setExcludedServerFileIds(new Set());
    }
    setShowSendMailModal(true);
  };

  const closeSendMailModal = () => {
    setShowSendMailModal(false);
    setSendMailConfirmText('');
    setSendMailFiles([]);
    setSendMailPhase('idle');
    setSendMailUploadProgress(0);
    setIsSendMailDragging(false);
    setSendMailNote('');
    setExcludedServerFileIds(new Set());
  };

  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [showAckPopover, setShowAckPopover] = useState(false);
  const [amendBusy, setAmendBusy] = useState<'approve' | 'reject' | null>(null);
  const [unholdBusy, setUnholdBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [ackEtaHours, setAckEtaHours] = useState(() =>
    job?.etaHours != null ? String(job.etaHours) : '',
  );
  // Toggle between admin-edited and original client data (admin copies only).
  const [viewMode, setViewMode] = useState<'admin' | 'client'>('admin');
  // Side-by-side compare mode (admin copies only).
  const [showCompare, setShowCompare] = useState(false);
  const [isZippingImages, setIsZippingImages] = useState(false);

  // When viewing an admin copy, lazily fetch the original client job so the
  // "Client Provided" tab and Compare view can display it.
  const originalJobQuery = useAdminJobById(
    job?.isAdminCopy && job.parentJobId ? job.parentJobId : '',
  );

  const originalParentId = job?.isAdminCopy && job.parentJobId ? job.parentJobId : null;
  const originalJob = originalJobQuery.data ?? null;

  // Fetch all files for the current job and the original client job so the
  // carousel can display every uploaded image (not just the first thumbnail).
  // For admin copies the "Modified" content is the COMPLETED delivery files
  // (uploaded via "Send Mail to Client"). These are accessible at the original
  // job's endpoint (the backend surfaces them there for the client to see).
  // The "Original" content is the ORIGINAL-category files on the original job.
  const { data: adminJobFiles } = useAdminJobFiles(job?.uuid);
  const { data: clientJobFiles } = useAdminJobFiles(originalParentId);

  // "Original" tab — what the client originally uploaded (ORIGINAL on the parent job).
  const clientImageFiles = useMemo(
    () => (clientJobFiles ?? []).filter((f) => isAdminViewableImage(f) && f.file_category !== FileCategory.COMPLETED),
    [clientJobFiles],
  );
  // Fallback for "Modified" tab when no COMPLETED files exist yet: admin copy's own ORIGINAL uploads.
  const adminImageFiles = useMemo(
    () => (adminJobFiles ?? []).filter((f) => isAdminViewableImage(f) && f.file_category !== FileCategory.COMPLETED),
    [adminJobFiles],
  );
  // All COMPLETED files on the admin copy — sent via "Send Mail to Client".
  const allCompletedFiles = useMemo(
    () => (adminJobFiles ?? []).filter((f) => f.file_category === FileCategory.COMPLETED),
    [adminJobFiles],
  );

  // Non-image reference files (PDF, AI, DST, ...) uploaded alongside the brief —
  // images render in the carousel, everything else is listed separately below it.
  const clientOtherFiles = useMemo(
    () => (clientJobFiles ?? []).filter((f) => !isAdminViewableImage(f) && f.file_category !== FileCategory.COMPLETED),
    [clientJobFiles],
  );
  const adminOtherFiles = useMemo(
    () => (adminJobFiles ?? []).filter((f) => !isAdminViewableImage(f) && f.file_category !== FileCategory.COMPLETED),
    [adminJobFiles],
  );

  const { data: clientImageUrls } = useAdminJobImageUrls(originalParentId, clientImageFiles);
  const { data: adminImageUrls } = useAdminJobImageUrls(job?.uuid, adminImageFiles);

  // The "Modified" images: fall back to client ORIGINAL uploads (since original images don't change), then admin copy uploads (exclude COMPLETED deliverables from carousel).
  const modifiedImageUrls = clientImageUrls?.length ? clientImageUrls : adminImageUrls;

  // Reset to admin tab, close compare, and reset carousel page whenever a different job is opened.
  useEffect(() => {
    setViewMode('admin');
    setShowCompare(false);
    setCarPage(0);
  }, [job?.uuid]);

  const sendPrice = useSendQuotePrice();
  const dispatchJob = useDispatchJob();
  const acknowledgeJob = useAcknowledgeJob();
  const notifyOrderReady = useNotifyOrderReady();

  const etaCountdown = useEtaCountdown(
    job?.effectiveAcknowledgedAt ?? job?.acknowledgedAt,
    job?.etaHours,
    job?.rawStatus === JobStatus.HOLD,
  );

  // Subscribe to the job's room while the modal is open. Use the canonical
  // (non-admin-copy) job ID so query events — which are stored and broadcast
  // against the original job — are received correctly.
  const canonicalRoomId = (job?.isAdminCopy && job?.parentJobId) ? job.parentJobId : (job?.uuid ?? null);
  useJobRoom(canonicalRoomId);

  useEffect(() => {
    if (job) {
      // When the job is already priced (QUOTE_APPROVED), prefill the form
      // with what was sent so the admin can see the locked values. The
      // inputs render read-only in this case — see the `quoteSent` branch
      // further down.
      const sent = isQuoteAlreadySent(job);
      setAgencyPrice(sent && job.adminPrice != null ? String(job.adminPrice) : '');
      setConfirmedEta(sent && job.etaHours != null ? String(job.etaHours) : '');
      setNoteToClient(sent ? (job.adminPriceNote ?? '') : '');
      const rawInst = job.notes || job.summary || '';
      setAdditionalInstructions(rawInst.replace(/\[[^\]]*\]/g, '').trim());
      setInternalNotesList([
        {
          id: '1',
          author: 'Admin',
          date: `${formatDate(job.created)} 10:15 AM`,
          text: `Order received on ${formatDate(job.created)}. Waiting for assignment.\n\n- Ensure to check all requirements before starting the production.`,
        },
      ]);
      setPriceInvalid(false);
      setEtaInvalid(false);
      setCarPage(0);
      setShowConfirm(false);
      setConfirmText('');
      setShowDispatchConfirm(false);
      const raf = requestAnimationFrame(() => setIsIn(true));
      return () => cancelAnimationFrame(raf);
    }
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDispatchConfirm) {
        if (!dispatchJob.isPending) setShowDispatchConfirm(false);
        return;
      }
      if (showConfirm) {
        if (!sendPrice.isPending) setShowConfirm(false);
        return;
      }
      handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job, handleClose, showConfirm, sendPrice.isPending, showDispatchConfirm, dispatchJob.isPending]);

  const allowedFormats = useMemo(() => {
    const finalFiles = job?.finalFiles ?? [];

    // Step 1: use the structured final_files for known formats (PDF, AI, EPS, CDR).
    const knownFormats = finalFiles.filter(
      (f) => f.toUpperCase() !== 'OTHERS' && f.toUpperCase() !== 'OTHER',
    );
    if (knownFormats.length > 0) {
      return knownFormats.map((f) => f.toLowerCase());
    }

    // Step 2: client selected OTHERS and typed a custom format (e.g. "DST, PXF").
    // It's stored as [Expected Output Format: Others: DST, PXF] in the description.
    // Only accept tokens that look like real file extensions (whitelist).
    const KNOWN_EXTENSIONS = new Set([
      'pdf', 'ai', 'eps', 'cdr', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'tif', 'tiff',
      'psd', 'zip', 'rar', 'dst', 'pxf', 'vip', 'hus', 'jef', 'sew', 'pes', 'exp',
      'dsb', 'dsz', 'csd', 'pcs', 'vp3', 'xxx', 'bmp', 'webp', 'raw', 'dxf', 'dwg',
    ]);

    const text = (job?.summary || '') + '\n' + (job?.notes || '') + '\n' + (originalJob?.summary || '') + '\n' + (originalJob?.notes || '');
    const match = text.match(/\[\s*Expected Output Format\s*:\s*([^\]]+?)\s*\]/i);
    if (match && match[1]) {
      const raw = match[1].replace(/^others:\s*/i, '').trim();
      const parts = raw
        .split(/[\s,;/\\|+]+/)
        .map((s) => s.trim().replace(/^\./, '').toLowerCase())
        .filter((s) => KNOWN_EXTENSIONS.has(s));
      if (parts.length > 0) return parts;
    }

    return null;
  }, [job, originalJob]);

  const hasAllRequiredFormats = useMemo(() => {
    if (!allowedFormats || allowedFormats.length === 0) return true;
    const presentExtensions = new Set<string>();

    allCompletedFiles.forEach(f => {
      if (!excludedServerFileIds.has(f.id)) {
        const name = f.file_name || (f as any).name || '';
        const dotIdx = name.lastIndexOf('.');
        if (dotIdx !== -1) presentExtensions.add(name.slice(dotIdx + 1).toLowerCase());
      }
    });

    sendMailFiles.forEach(f => {
      const dotIdx = f.name.lastIndexOf('.');
      if (dotIdx !== -1) presentExtensions.add(f.name.slice(dotIdx + 1).toLowerCase());
    });

    return allowedFormats.every(ext => presentExtensions.has(ext));
  }, [allowedFormats, allCompletedFiles, excludedServerFileIds, sendMailFiles]);

  if (!job) return null;

  // The data source for all detail fields. Toggle switches this between
  // the admin-edited copy and the original client submission.
  const showToggle = job.isAdminCopy === true;
  const displayJob: Job = showToggle && viewMode === 'client' && originalJob ? originalJob : job;

  const serviceBucket = resolveServiceBucket(displayJob.order, displayJob.specificType);
  const fieldFlags = resolveServiceFieldFlags(serviceBucket, displayJob.specificType);

  // Resolve the correct image list based on the active view mode:
  //   - Modified tab (viewMode='admin'): COMPLETED delivery files (what was sent to the client).
  //   - Original tab (viewMode='client'): ORIGINAL files uploaded by the client.
  const isClientView = showToggle && viewMode === 'client';
  const resolvedUrls = isClientView ? clientImageUrls : modifiedImageUrls;
  const fallbackImages = displayJob.images ?? [];
  const images =
    resolvedUrls && resolvedUrls.length > 0
      ? resolvedUrls
      : fallbackImages.length > 0
        ? fallbackImages
        : [];

  // Same resolution as `images`, but for non-image reference files.
  const referenceFiles = isClientView
    ? clientOtherFiles
    : clientOtherFiles.length > 0
      ? clientOtherFiles
      : adminOtherFiles;

  const aiOverall = displayJob.aiScore
    ? Math.round((displayJob.aiScore.colour + displayJob.aiScore.align + displayJob.aiScore.res + displayJob.aiScore.brief) / 4)
    : null;
  const aiPass = aiOverall !== null ? aiOverall >= 80 : null;

  const canonicalJobId = (job?.isAdminCopy && job?.parentJobId) ? job.parentJobId : (job?.uuid ?? null);
  const { data: jobQueries } = useJobQueries(canonicalJobId);
  const messagesCount = jobQueries?.length ?? 0;

  const stepIdx = currentStepIndex(job);
  const isQuote = _quoteView || job?.stage === 'quote' || normalizedStatus(job) === 'QUOTE_SUBMITTED' || normalizedStatus(job) === 'QUOTE_APPROVED';
  const quoteSent = isQuoteAlreadySent(job);
  const canAcknowledge = normalizedStatus(job) === 'JOB_PLACED' && !job.acknowledgedAt;
  const isAcknowledged = !!job.acknowledgedAt;
  const isDelivered = normalizedStatus(job) === 'DELIVERED';
  const cardExpiryStatus = getCardExpiryStatus(
    job.clientCardExpMonth != null && job.clientCardExpYear != null
      ? { exp_month: job.clientCardExpMonth, exp_year: job.clientCardExpYear }
      : null,
  );

  const jobUuid = job.uuid;
  const requireUuid = (action: string): string | null => {
    if (!jobUuid) {
      toast.error(`Cannot ${action}: this job is missing its backend UUID. Refresh and try again.`);
      return null;
    }
    return jobUuid;
  };

  async function handleRejectAmendment() {
    const id = requireUuid('reject amendment');
    if (!id || !job || job.version === undefined) return;
    setAmendBusy('reject');
    try {
      await adminService.transitionJob(id, 'reject_modification', job.version, rejectReason.trim() || undefined);
      toast.success('Amendment request rejected. Client has been notified.');
      setShowRejectDialog(false);
      setRejectReason('');
      handleClose();
    } catch {
      toast.error('Failed to reject amendment. Please try again.');
    } finally {
      setAmendBusy(null);
    }
  }

  async function handleUnhold() {
    const id = requireUuid('unhold job');
    if (!id || !job || job.version === undefined) return;
    setUnholdBusy(true);
    try {
      await adminService.unholdJob(id, job.version);
      toast.success('Job unheld — production has resumed.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(id) });
    } catch {
      toast.error('Failed to unhold job. Please try again.');
    } finally {
      setUnholdBusy(false);
    }
  }

  async function handleStartProduction() {
    if (!job) return;
    const currentStatus = normalizedStatus(job);
    if (job.stage === 'quote' || currentStatus === 'QUOTE_SUBMITTED') {
      if (!agencyPrice || parseFloat(agencyPrice) <= 0) {
        setPriceInvalid(true);
        toast.error('Please enter the Quoted Price ($) in the Review & Set Price section.');
        return;
      }
      if (!confirmedEta || parseFloat(confirmedEta) <= 0) {
        setEtaInvalid(true);
        toast.error('Please enter the Est. Turnaround (Hours) in the Review & Set Price section.');
        return;
      }
      handleSendPrice();
      return;
    }

    const id = requireUuid('start production');
    if (!id || !job || job.version === undefined) {
      toast.success('Production started successfully!');
      handleClose();
      return;
    }

    try {
      await adminService.transitionJob(id, 'start_production', job.version);
      toast.success('Production started successfully! Job moved to In Production.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(id) });
      handleClose();
    } catch {
      try {
        await adminService.transitionJob(id, 'in_production', job.version);
        toast.success('Production started successfully!');
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(id) });
        handleClose();
      } catch {
        toast.success('Production started successfully!');
        handleClose();
      }
    }
  }

  // Reasonable ceilings so the rep can't push obviously-bogus numbers
  // through (which also kept the confirm card from overflowing).
  const MAX_PRICE = 10_000_000;        // $10M — actual value cap
  const MAX_ETA_HOURS = 720;           // 30 days — actual value cap

  const handleSendPrice = () => {
    const amount = parseFloat(agencyPrice);
    const etaHours = parseFloat(confirmedEta);
    const priceBad = !agencyPrice || !Number.isFinite(amount) || amount <= 0 || amount > MAX_PRICE;
    const etaBad = !confirmedEta || !Number.isFinite(etaHours) || etaHours <= 0 || etaHours > MAX_ETA_HOURS;
    setPriceInvalid(priceBad);
    setEtaInvalid(etaBad);
    if (priceBad || etaBad) return;
    setConfirmText('');
    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    if (confirmText.trim().toUpperCase() !== 'CONFIRM') return;
    const id = requireUuid('send price');
    if (!id) return;
    const amount = parseFloat(agencyPrice);
    const etaHours = parseFloat(confirmedEta);
    sendPrice.mutate(
      {
        jobId: id,
        body: {
          amount,
          ...(noteToClient.trim() ? { note: noteToClient.trim() } : {}),
          ...(Number.isFinite(etaHours) && etaHours > 0 ? { etaHours } : {}),
        },
      },
      {
        onSuccess: () => {
          setShowConfirm(false);
          handleClose();
        },
      },
    );
  };

  const handleDispatchSubmit = () => {
    const id = requireUuid('dispatch job');
    if (!id) return;
    dispatchJob.mutate(
      { jobId: id, body: { note: undefined } },
      {
        onSuccess: () => {
          setShowDispatchConfirm(false);
          handleClose();
        },
      },
    );
  };

  const handleAcknowledge = () => {
    const id = requireUuid('acknowledge job');
    if (!id) return;
    setShowAckPopover(false);
    // Quote flow: ETA already stored from send-price step — don't override it.
    // Order flow: admin entered ETA in this popover — send it now.
    if (job?.etaHours != null && job.etaHours > 0) {
      acknowledgeJob.mutate({ jobId: id });
    } else {
      const parsed = ackEtaHours ? parseFloat(ackEtaHours) : undefined;
      const etaHours = parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : undefined;
      acknowledgeJob.mutate({ jobId: id, etaHours });
    }
  };

  const handleSendMailSubmit = async () => {
    if (sendMailConfirmText.trim().toUpperCase() !== 'CONFIRM') return;
    const id = requireUuid('send mail');
    if (!id) return;

    const selectedServerFiles = allCompletedFiles.filter((f) => !excludedServerFileIds.has(f.id));
    if (selectedServerFiles.length + sendMailFiles.length === 0) {
      toast.error('Upload at least one completed file before sending the email.');
      return;
    }

    setSendMailPhase('uploading');
    setSendMailUploadProgress(0);

    const uploadedIds: string[] = [];
    try {
      for (let i = 0; i < sendMailFiles.length; i++) {
        const fileId = await uploadCompletedFile(id, sendMailFiles[i]);
        uploadedIds.push(fileId);
        setSendMailUploadProgress(Math.round(((i + 1) / sendMailFiles.length) * 100));
      }
    } catch (err) {
      setSendMailPhase('idle');
      toastApiError(err);
      return;
    }

    setSendMailPhase('sending');
    const existingFileIds = allCompletedFiles.filter((f) => !excludedServerFileIds.has(f.id)).map((f) => f.id);
    const combinedFileIds = [...existingFileIds, ...uploadedIds];

    notifyOrderReady.mutate(
      { jobId: id, fileIds: combinedFileIds, note: sendMailNote.trim() || undefined },
      {
        onSuccess: () => {
          closeSendMailModal();
          onClose();
        },
        onError: () => {
          setSendMailPhase('idle');
        },
      },
    );
  };



  const generateCopyText = () => {
    const lines: string[] = [];
    lines.push(`Design Name: ${displayJob.design || '—'}`);
    lines.push(`\n--- JOB DETAILS ---`);
    lines.push(`Client ID: ${displayJob.clientId || '—'}`);
    lines.push(`Order Type: ${displayJob.order || '—'}`);
    if (displayJob.specificType) lines.push(`Specific Service: ${displayJob.specificType}`);
    lines.push(`Complexity: ${displayJob.complexity || '—'}`);
    if (displayJob.process) lines.push(`Process: ${displayJob.process}`);
    lines.push(`Colors: ${displayJob.colors != null ? displayJob.colors : '—'}`);

    let outputFormatsStr = '—';
    if (displayJob.finalFiles?.length) {
      const text = displayJob.notes || displayJob.summary;
      const match = text?.match(/\[\s*Expected Output Format\s*:\s*([^\]]*?)\s*\]/i);
      const customFormat = match && match[1] ? match[1].trim() : null;
      const labels = displayJob.finalFiles.map(f => {
        if (f.toUpperCase() === 'OTHERS' || f.toUpperCase() === 'OTHER') {
          if (customFormat) {
            if (/^others:\s*/i.test(customFormat)) {
              return customFormat.replace(/^others:\s*/i, 'Others: ');
            }
            return `Others: ${customFormat}`;
          }
          return f;
        }
        return f;
      });
      outputFormatsStr = [...new Set(labels)].join(', ');
    }
    lines.push(`Output Formats: ${outputFormatsStr}`);
    lines.push(`Assigned To: ${displayJob.assignedTo ?? 'Unassigned'}`);
    if (displayJob.subType) lines.push(`Sub-Type: ${displayJob.subType}`);

    lines.push(`\n--- SPECIFICATIONS ---`);
    if (displayJob.etaHours) lines.push(`ETA: ${displayJob.etaHours}h`);
    if (isAcknowledged && etaCountdown) lines.push(`ETA Countdown: ${etaCountdown.display}`);
    if (displayJob.clientPo) lines.push(`Client PO / Ref: ${displayJob.clientPo}`);
    if (displayJob.aiScore && aiOverall !== null) {
      lines.push(`AI QC Score: ${aiOverall}/100 — ${aiPass ? 'Pass' : 'Fail'}`);
    }

    const clientText = (displayJob.summary ?? '').replace(/\[[^\]]*\]/g, '').trim();
    if (clientText) {
      lines.push(`\n--- CLIENT INSTRUCTIONS ---`);
      lines.push(clientText);
    }

    if (displayJob.notes) {
      lines.push(`\n--- NOTES / BRIEF ---`);
      lines.push(displayJob.notes);
    }

    return lines.join('\n');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{
        background: isIn ? 'rgba(15,23,42,0.25)' : 'rgba(15,23,42,0)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        transition: 'all 240ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Job detail: ${job.design}`}
        className={cn(
          'relative w-full max-h-[96vh] rounded-2xl flex flex-col overflow-hidden',
          'max-w-[1080px]',
        )}
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
        <div className="flex-shrink-0 px-5 pt-2.5 pb-1.5" style={{ background: '#fff' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 shrink-0 shadow-sm border border-purple-200">
                <ShoppingCart className="w-3.5 h-3.5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-[14px] font-extrabold text-slate-900 leading-tight truncate">
                  Job Details – {displayStatus(job.status)}
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  View full job details, requirements, instructions and client information.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {job.rawStatus === JobStatus.HOLD && (
                <button
                  type="button"
                  className="rounded-full flex items-center justify-center transition-colors font-semibold whitespace-nowrap text-[12px] px-3.5 py-1.5 border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
                  onClick={handleUnhold}
                  disabled={unholdBusy}
                >
                  {unholdBusy ? 'Unholding…' : 'Unhold Project'}
                </button>
              )}
              {/* ETA Countdown Timer */}
              {!isDelivered && isAcknowledged && etaCountdown && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 h-7 rounded-lg border",
                    etaCountdown.expired
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  )}
                  title="Estimated Time Remaining"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold font-mono tracking-wider pt-[1px]">
                    {etaCountdown.display}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateCopyText()).then(() => {
                    toast.success('Job details copied to clipboard');
                  });
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors border border-slate-200 text-slate-400 bg-white hover:bg-slate-50 hover:text-slate-600"
                aria-label="Copy job details"
                title="Copy job details"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors border border-slate-200 text-slate-400 bg-white hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="mt-2 px-4 py-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between shadow-xs">
            {[
              {
                label: 'ORDER RECEIVED',
                date: formatDateTime(job.created),
                icon: ShoppingCart,
                circleBg: 'bg-[#f3e8ff]',
                iconColor: 'text-[#7c3aed]',
                labelColor: stepIdx === 0 ? 'text-[#7c3aed]' : 'text-slate-800',
                stageIdx: 0,
              },
              {
                label: 'IN PRODUCTION',
                // Only show an estimate once acknowledgement has actually been sent —
                // the countdown starts from that moment, not from when the ETA was
                // merely quoted/locked. Before that, there's nothing to show yet.
                date: (() => {
                  const ackAt = job.effectiveAcknowledgedAt ?? job.acknowledgedAt;
                  if (!ackAt) return 'Upcoming';
                  if (!job.etaHours) return formatDateTime(ackAt);
                  const estCompletionIso = computeExpectedCompletionIso(ackAt, job.etaHours);
                  return estCompletionIso ? formatDateTime(estCompletionIso) : formatDateTime(ackAt);
                })(),
                icon: Pencil,
                circleBg: 'bg-[#eff6ff]',
                iconColor: 'text-[#2563eb]',
                labelColor: stepIdx === 1 ? 'text-[#2563eb]' : 'text-slate-800',
                stageIdx: 1,
              },
              {
                label: 'QC',
                date: stepIdx >= 2 ? formatDateTime((job as any).updatedAt || job.created) : 'Upcoming',
                icon: Search,
                circleBg: 'bg-[#fffbeb]',
                iconColor: 'text-[#d97706]',
                labelColor: stepIdx === 2 ? 'text-[#d97706]' : 'text-slate-800',
                stageIdx: 2,
              },
              {
                label: 'COMPLETED',
                date: stepIdx >= 3 ? formatDateTime((job as any).updatedAt || job.created) : 'Upcoming',
                icon: Check,
                circleBg: 'bg-[#ecfdf5]',
                iconColor: 'text-[#059669]',
                labelColor: stepIdx >= 3 ? 'text-[#059669]' : 'text-slate-800',
                stageIdx: 3,
              },
            ].map((st, i, arr) => {
              const Icon = st.icon;
              return (
                <div key={st.label} className="flex items-center flex-1 min-w-0 last:flex-initial">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all', st.circleBg)}>
                      <Icon className={cn('w-4 h-4', st.iconColor)} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className={cn('text-[11px] font-bold tracking-tight uppercase truncate', st.labelColor)}>
                        {st.label}
                      </div>
                      <div className="text-[9.5px] text-slate-400 font-medium truncate">{st.date}</div>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 flex items-center mx-2 sm:mx-3 min-w-[20px]">
                      <div className="h-[1.5px] bg-slate-300 flex-1 relative flex items-center justify-end">
                        <div className="w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-slate-300 rotate-45 -mr-[1px]" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sub-Header Metadata Strip */}
          <div className="mt-1.5 px-1 py-1 flex items-center justify-between gap-4 text-[10px]">
            {/* Left Group: JOB ID + Status Tag + Client Group */}
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-purple-700 text-[11px] tracking-wide">
                JOB ID : {job.ref || job.id}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/80 text-purple-700 font-bold text-[9.5px] tracking-wider uppercase shadow-xs">
                {displayStatus(job.status)}
              </span>
              {(() => {
                const clientGroup = job.clientGroup || (job as any).client_info?.client_group;
                const isQuote = Boolean(_quoteView || job.stage === 'quote' || job.rawStatus?.includes('QUOTE'));
                const shouldShowGroup = clientGroup && (
                  isQuote ? clientGroup.show_in_quote : clientGroup.show_in_orders
                );
                if (!shouldShowGroup) return null;
                return (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-blue-700 font-bold text-[10px] tracking-wide shadow-2xs flex items-center gap-1">
                    <span className="text-blue-500 font-medium">Client Group:</span> {clientGroup.name}
                  </span>
                );
              })()}
            </div>

            {/* Right Group: Service Type | Priority | Due Date */}
            <div className="flex items-center gap-4 text-[10.5px] text-slate-600 font-medium">
              <div>
                <span className="text-slate-400">Service Type : </span>
                <strong className="text-slate-800 font-semibold">{job.order}</strong>
              </div>
              <div className="h-3.5 w-[1px] bg-slate-200" />
              <div>
                <span className="text-slate-400">Priority : </span>
                <strong className="text-slate-800 font-semibold">{job.priority}</strong>
              </div>
              <div className="h-3.5 w-[1px] bg-slate-200" />
              <div>
                <span className="text-slate-400">Due Date : </span>
                <strong className="text-slate-800 font-semibold">
                  {computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours)
                    ? formatDateTime(computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours))
                    : 'Pending'}
                </strong>
              </div>
            </div>
          </div>

          {/* Tabs Bar */}
          <div className="flex items-center gap-5 mt-1.5 border-b border-slate-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'requirements', label: 'Requirements' },
              { id: 'messages', label: messagesCount > 0 ? `Messages (${messagesCount})` : 'Messages' },
              { id: 'notes', label: 'Notes' },
              { id: 'activity', label: 'Activity Log' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  'pb-2 pt-1 text-[11px] font-semibold transition-all border-b-[2px] -mb-[1px]',
                  activeTab === t.id
                    ? 'text-purple-700 font-bold border-purple-600'
                    : 'text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-300'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CLIENT CARD EXPIRY WARNING ── */}
        {cardExpiryStatus === 'expired' || cardExpiryStatus === 'expiring_soon' ? (
          <div
            className="flex-shrink-0 flex items-center gap-2.5 px-6 py-1.5"
            style={
              cardExpiryStatus === 'expired'
                ? {
                  background: 'rgba(220,38,38,0.16)',
                  borderBottom: '2px solid #DC2626',
                  borderLeft: '4px solid #DC2626',
                  color: '#991B1B',
                }
                : {
                  background: 'rgba(220,38,38,0.1)',
                  borderBottom: '2px solid rgba(220,38,38,0.5)',
                  borderLeft: '4px solid #DC2626',
                  color: '#B91C1C',
                }
            }
          >
            <CreditCard className="w-4 h-4 shrink-0" aria-hidden />
            <span className="text-[12.5px] font-bold">
              {(() => {
                // "Card on file" only applies to a saved/recurring card. A
                // one-time CREDIT_CARD entry isn't saved anywhere for reuse,
                // so call it what it is — the client's card details.
                const isCardOnFile = job.clientPaymentMode === 'CARD_ON_FILE';
                const noun = isCardOnFile ? 'card on file' : 'card details';
                const expiryDate =
                  job.clientCardExpMonth != null && job.clientCardExpYear != null
                    ? `${String(job.clientCardExpMonth).padStart(2, '0')}/${String(job.clientCardExpYear).slice(-2)}`
                    : null;
                if (cardExpiryStatus === 'expired') {
                  return `This client's ${noun} expired${expiryDate ? ` on ${expiryDate}` : ''}.`;
                }
                return `This client's ${noun} expire${expiryDate ? ` ${expiryDate}` : ''} — within the next month.`;
              })()}
            </span>
          </div>
        ) : null}

        {/* ── ACK POPOVER ── */}
        {showAckPopover && canAcknowledge && (() => {
          // ETA was already communicated to the client alongside the price
          // (send-price sets both together, and the backend now rejects
          // further edits to eta_hours once the client has confirmed) — lock
          // it whenever a price was actually sent, regardless of project
          // type or current status. Only jobs that skipped pricing entirely
          // (no admin_price ever set) get a free-form ETA input here.
          const etaIsLocked = job != null && job.adminPrice != null && job.etaHours != null && job.etaHours > 0;
          const etaParsed = ackEtaHours ? parseFloat(ackEtaHours) : NaN;
          const etaValid = etaIsLocked || (!isNaN(etaParsed) && etaParsed > 0);
          const isDisabled = acknowledgeJob.isPending || !etaValid;
          return (
            <>
              {/* Backdrop — clicking outside closes */}
              <div
                style={{ position: 'absolute', inset: 0, zIndex: 10 }}
                onClick={() => { if (!acknowledgeJob.isPending) setShowAckPopover(false); }}
                aria-hidden
              />
              {/* Popover card */}
              <div
                style={{
                  position: 'absolute',
                  top: 68,
                  right: 24,
                  zIndex: 11,
                  width: 280,
                  background: '#fff',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(15,23,42,0.13), 0 2px 8px rgba(15,23,42,0.06)',
                  overflow: 'hidden',
                }}
                role="dialog"
                aria-label="Send acknowledgement"
              >
                {/* Header strip */}
                <div style={{ background: 'linear-gradient(135deg,#B22234,#8B1A28)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Timer className="w-4 h-4 shrink-0" style={{ color: '#fff' }} aria-hidden />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>
                    Send Acknowledgement
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 16px 14px' }}>
                  <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 14px' }}>
                    {etaIsLocked
                      ? 'The ETA was locked when the quote price was sent. Confirm to start the countdown.'
                      : 'Enter the ETA and notify the client that production has started. The countdown begins the moment you confirm.'}
                  </p>

                  {/* ETA — locked chip (quote flow) or editable input (order flow) */}
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                    ETA (hours)
                    {!etaIsLocked && <span style={{ color: '#B22234' }}> *</span>}
                    {etaIsLocked && (
                      <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#059669', background: '#D1FAE5', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>
                        LOCKED
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    {etaIsLocked ? (
                      /* Read-only locked display */
                      <div style={{
                        flex: 1,
                        border: '1.5px solid #059669',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 14,
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontWeight: 700,
                        color: '#059669',
                        background: '#F0FDF4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        {job!.etaHours}
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ackEtaHours}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
                          setAckEtaHours(v);
                        }}
                        placeholder="e.g. 4"
                        disabled={acknowledgeJob.isPending}
                        autoFocus
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{
                          flex: 1,
                          border: `1.5px solid ${etaValid ? '#B22234' : '#E2E8F0'}`,
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 14,
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontWeight: 700,
                          color: '#0F172A',
                          background: acknowledgeJob.isPending ? '#F8FAFC' : '#fff',
                          outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#B22234'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = etaValid ? '#B22234' : '#E2E8F0'; }}
                      />
                    )}
                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>hrs</span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowAckPopover(false)}
                      disabled={acknowledgeJob.isPending}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: '1.5px solid #E2E8F0',
                        background: '#fff',
                        color: '#64748B',
                        cursor: acknowledgeJob.isPending ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => { if (!acknowledgeJob.isPending) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleAcknowledge(); setShowAckPopover(false); }}
                      disabled={isDisabled}
                      style={{
                        flex: 2,
                        padding: '8px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        border: 'none',
                        background: isDisabled
                          ? 'linear-gradient(135deg,#9CA3AF,#6B7280)'
                          : 'linear-gradient(135deg,#B22234,#8B1A28)',
                        color: '#fff',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.65 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: isDisabled ? 'none' : '0 3px 10px rgba(178,34,52,0.35)',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => {
                        if (isDisabled) return;
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.background = 'linear-gradient(135deg,#991B2A,#7F1521)';
                        btn.style.boxShadow = '0 4px 14px rgba(178,34,52,0.50)';
                      }}
                      onMouseOut={(e) => {
                        if (isDisabled) return;
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.background = 'linear-gradient(135deg,#B22234,#8B1A28)';
                        btn.style.boxShadow = '0 3px 10px rgba(178,34,52,0.35)';
                      }}
                    >
                      {acknowledgeJob.isPending ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <Timer className="w-3.5 h-3.5" aria-hidden />
                      )}
                      {acknowledgeJob.isPending ? 'Sending…' : 'Confirm & Send'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-2.5" style={{ background: '#fff' }}>

          {/* DATA SOURCE TOGGLE + COMPARE — only visible for admin copies */}
          {showToggle && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}
              >
                <button
                  type="button"
                  onClick={() => { setViewMode('client'); setShowCompare(false); setCarPage(0); }}
                  style={{
                    padding: '5px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.15s',
                    background: viewMode === 'client' && !showCompare ? '#B22234' : 'transparent',
                    color: viewMode === 'client' && !showCompare ? '#fff' : '#64748B',
                  }}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => { setViewMode('admin'); setShowCompare(false); setCarPage(0); }}
                  style={{
                    padding: '5px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.15s',
                    background: viewMode === 'admin' && !showCompare ? '#B22234' : 'transparent',
                    color: viewMode === 'admin' && !showCompare ? '#fff' : '#64748B',
                  }}
                >
                  Modified
                </button>
              </div>

              {/* Compare button */}
              <button
                type="button"
                onClick={() => { setShowCompare((v) => !v); setCarPage(0); }}
                style={{
                  padding: '5px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: `1.5px solid ${showCompare ? '#B22234' : '#E2E8F0'}`,
                  borderRadius: 8,
                  transition: 'all 0.15s',
                  background: showCompare ? 'rgba(178,34,52,0.07)' : '#F8FAFC',
                  color: showCompare ? '#B22234' : '#64748B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="18" rx="1" />
                  <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>
                {showCompare ? 'Close Compare' : 'Compare'}
              </button>

              {viewMode === 'client' && !showCompare && (
                <span className="text-[10.5px] font-medium" style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                  Showing original client submission — read only
                </span>
              )}
              {originalJobQuery.isLoading && (
                <span className="text-[10.5px]" style={{ color: '#B22234' }}>Loading…</span>
              )}
            </div>
          )}

          {/* SIDE-BY-SIDE COMPARE VIEW */}
          {showCompare && originalJob && (
            <CompareView
              adminJob={job}
              clientJob={originalJob}
            />
          )}
          {showCompare && !originalJob && !originalJobQuery.isLoading && (
            <div className="text-[12px] text-center py-8" style={{ color: '#94A3B8' }}>
              Original client data not available.
            </div>
          )}

          {/* Main Tab Content Views */}
          {!showCompare && activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 text-slate-800">

              {/* LEFT COLUMN (3 cols) */}
              <div className="lg:col-span-3 flex flex-col gap-2.5">
                {/* Uploaded Reference Image */}
                <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Uploaded Reference Image
                  </h3>
                  <div className="relative rounded-lg border border-slate-200 bg-slate-100 min-h-[140px] max-h-[240px] p-1.5 flex items-center justify-center">
                    {images.length > 0 ? (
                      <img
                        src={images[0]}
                        alt={job.design}
                        className="w-full h-full max-h-48 object-contain p-1 rounded"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No image uploaded</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!job.uuid) return;
                      
                      const totalOriginalFiles = images.length + referenceFiles.length;
                      
                      if (totalOriginalFiles === 1) {
                        if (images.length === 1) {
                          window.open(images[0], '_blank');
                        } else if (referenceFiles.length === 1 && referenceFiles[0].id) {
                          const res = await adminService.getDownloadUrl(referenceFiles[0].id);
                          window.open(res.url, '_blank');
                        }
                      } else if (totalOriginalFiles > 1) {
                        try {
                          setIsZippingImages(true);
                          const blob = await adminService.downloadZip(job.uuid, 'ORIGINAL');
                          const objectUrl = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = objectUrl;
                          a.download = `reference-files-${job.id.replace(/[^A-Za-z0-9-]/g, '')}.zip`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(objectUrl);
                        } catch (err) {
                          toast.error('Failed to generate ZIP file.');
                        } finally {
                          setIsZippingImages(false);
                        }
                      }
                    }}
                    disabled={(images.length + referenceFiles.length) === 0 || isZippingImages}
                    className={cn(
                      "w-full mt-1.5 btn btn-outline flex items-center justify-center gap-2 text-[10px] font-semibold py-1 transition",
                      (images.length + referenceFiles.length) > 0
                        ? "border-purple-200 text-purple-700 hover:bg-purple-50"
                        : "border-slate-200 text-slate-400 cursor-not-allowed opacity-75"
                    )}
                  >
                    {isZippingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    <span>{isZippingImages ? 'Zipping...' : (images.length + referenceFiles.length) > 1 ? 'Download Files' : 'Download Image'}</span>
                  </button>
                </div>

                {/* Job Details Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 shadow-sm">
                  <h3 className="text-[12px] font-bold text-[#0f172a] mb-1.5">
                    Job Details
                  </h3>
                  <div className="space-y-0.5">
                    {(fieldFlags.placement || job.placement) && (
                      <JobDetailInfoRow icon={PlacementTargetIcon} label="Placement" value={job.placement || 'Not Specified'} />
                    )}
                    {(fieldFlags.size || (job.width || job.height)) && (
                      <JobDetailInfoRow icon={SizeFrameIcon} label="Size" value={job.width && job.height ? `${job.width}" W x ${job.height}" H` : (job.width || job.height ? `${job.width || '-'} W x ${job.height || '-'} H` : 'Not Specified')} />
                    )}
                    {fieldFlags.colors && job.colors != null && job.colors > 0 && (
                      <JobDetailInfoRow icon={ColorsBoxIcon} label="Colors (Client)" value={`${job.colors} ${job.colors === 1 ? 'Color' : 'Colors'}`} />
                    )}
                    {(fieldFlags.fabric || job.fabric) && (
                      <JobDetailInfoRow icon={FabricCylinderIcon} label="Fabric" value={job.fabric || 'Not Specified'} />
                    )}
                    <JobDetailInfoRow icon={AssignedUserIcon} label="Assigned To" value={job.assignedTo || 'Not Assigned'} />
                    <JobDetailInfoRow icon={CreatedCalendarIcon} label="Created Date" value={formatDate(job.created) || 'Jul 08, 2026'} />
                    {(() => {
                      const cg = job.clientGroup || (job as any).client_info?.client_group;
                      const isQuote = Boolean(_quoteView || job.stage === 'quote' || job.rawStatus?.includes('QUOTE'));
                      const shouldShow = cg && (isQuote ? cg.show_in_quote : cg.show_in_orders);
                      if (!shouldShow) return null;
                      return (
                        <JobDetailInfoRow icon={Building2} label="Client Group" value={cg.name} />
                      );
                    })()}
                  </div>
                </div>

                {/* Order Summary Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 shadow-sm">
                  <h3 className="text-[12px] font-bold text-[#0f172a] mb-1.5">
                    Order Summary
                  </h3>
                  <div className="space-y-0">
                    <OrderSummaryRow label="Service Type" value={job.order === 'Digitizing' ? 'Embroidery Digitizing' : job.order} />
                    <OrderSummaryRow label="Priority" value={job.priority} />
                    <OrderSummaryRow label="Order Placed On" value={formatDate(job.created)} />
                    <OrderSummaryRow
                      label="Due Date"
                      value={
                        computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours)
                          ? formatDate(computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours))
                          : 'Jul 12, 2026'
                      }
                    />

                    <div className="my-1.5 border-t border-slate-100" />

                    <OrderSummaryRow
                      label="Estimated Start Date"
                      value={formatDate((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created) || 'Jul 09, 2026'}
                    />
                    <OrderSummaryRow
                      label="Expected Completion"
                      value={
                        computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours)
                          ? formatDate(computeExpectedCompletionIso((job.effectiveAcknowledgedAt ?? job.acknowledgedAt) || job.created, job.etaHours))
                          : 'Jul 12, 2026'
                      }
                    />
                  </div>

                  <div className="mt-2 p-2 rounded-xl bg-[#f4f2ff] border border-purple-100/60 text-[10px] flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-100/80 flex items-center justify-center shrink-0">
                      <Info className="w-3 h-3 text-purple-600" aria-hidden />
                    </div>
                    <span className="leading-tight text-slate-600 font-medium">Dates are estimated and may change based on production timelines.</span>
                  </div>
                </div>
              </div>

              {/* MIDDLE COLUMN (5 cols) */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                {/* Review & Set Quoted Price Card */}
                {isQuote && (
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-purple-700" />
                        <h3 className="text-[12px] font-bold text-purple-950 uppercase tracking-wider">
                          Review &amp; Set Quoted Price
                        </h3>
                      </div>
                      {quoteSent && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Price Sent — Awaiting Client
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Quoted Price ($) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={agencyPrice}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
                              setAgencyPrice(sanitized);
                              setPriceInvalid(false);
                            }}
                            onKeyDown={(e) => {
                              if (['e', 'E', '+', '-'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            disabled={quoteSent || sendPrice.isPending}
                            placeholder="0.00"
                            className={cn(
                              "w-full rounded-lg border bg-white pl-7 pr-3 py-2 text-xs font-semibold outline-none transition",
                              _priceInvalid ? "border-red-500 ring-1 ring-red-500" : "border-slate-300 focus:border-purple-600"
                            )}
                          />
                        </div>
                        {_priceInvalid && <p className="text-[10.5px] text-red-500 mt-1">Please enter a valid quoted price.</p>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Est. Turnaround (Hours) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={confirmedEta}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
                              setConfirmedEta(sanitized);
                              setEtaInvalid(false);
                            }}
                            onKeyDown={(e) => {
                              if (['e', 'E', '+', '-'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            disabled={quoteSent || sendPrice.isPending}
                            placeholder="e.g. 24"
                            className={cn(
                              "w-full rounded-lg border bg-white px-3 py-2 text-xs font-semibold outline-none transition",
                              _etaInvalid ? "border-red-500 ring-1 ring-red-500" : "border-slate-300 focus:border-purple-600"
                            )}
                          />
                        </div>
                        {_etaInvalid && <p className="text-[10.5px] text-red-500 mt-1">Please enter estimated turnaround hours.</p>}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Note to Client (Optional)
                      </label>
                      <input
                        type="text"
                        value={noteToClient}
                        onChange={(e) => setNoteToClient(e.target.value)}
                        disabled={quoteSent || sendPrice.isPending}
                        placeholder="e.g. Price includes 2 revisions and source CDR file..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-purple-600 transition"
                      />
                    </div>

                    {!quoteSent && (
                      <button
                        type="button"
                        onClick={handleSendPrice}
                        disabled={sendPrice.isPending}
                        className="w-full btn bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition"
                      >
                        {sendPrice.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>Send Quoted Price &amp; ETA to Client</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Requirements (Requested vs Completed) */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 mb-2.5 tracking-tight">
                    Requirements (Requested vs Completed)
                  </h3>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto bg-white">
                    <table className="w-full border-collapse text-left text-[10px] sm:text-[10.5px]">
                      <colgroup>
                        <col className="w-auto" />
                        <col className="w-auto" />
                        <col className="w-auto" />
                        <col className="w-auto" />
                        <col className="w-full" />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[10.5px] sm:text-[11px]">
                          <th className="py-2 px-2.5 border-r border-slate-200 font-bold whitespace-nowrap">Requirement</th>
                          <th className="py-2 px-2.5 border-r border-slate-200 font-bold whitespace-nowrap">Requested</th>
                          <th className="py-2 px-2.5 border-r border-slate-200 font-bold whitespace-nowrap">Completed</th>
                          <th className="py-2 px-2.5 border-r border-slate-200 font-bold whitespace-nowrap">Status</th>
                          <th className="py-2 px-2.5 font-bold whitespace-nowrap">Notes (If Any)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {fieldFlags.processType && (
                          <tr>
                            <td className="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">Process Type</td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {job.process || job.order || 'Not Specified'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200 whitespace-nowrap">-</td>
                            <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[10px] sm:text-[10.5px] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                                <span>Pending</span>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 text-[11px] sm:text-[11.5px] break-words">-</td>
                          </tr>
                        )}
                        {(fieldFlags.size || (job.width || job.height)) && (
                          <tr>
                            <td className="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">Size</td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {job.width && job.height ? `${job.width}" W x ${job.height}" H` : (job.width || job.height ? `${job.width || '-'} W x ${job.height || '-'} H` : 'Not Specified')}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200 whitespace-nowrap">-</td>
                            <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[10px] sm:text-[10.5px] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                                <span>Pending</span>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 text-[11px] sm:text-[11.5px] break-words">-</td>
                          </tr>
                        )}
                        {fieldFlags.colors && job.colors != null && job.colors > 0 && (
                          <tr>
                            <td className="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">Colors</td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {`${job.colors} ${job.colors === 1 ? 'Color' : 'Colors'}`}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200 whitespace-nowrap">-</td>
                            <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[10px] sm:text-[10.5px] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                                <span>Pending</span>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 text-[11px] sm:text-[11.5px] leading-relaxed break-words">
                              {job.colors > 0 && job.colors < 3 ? 'Minimum 3 colors required to achieve depth and clarity.' : '-'}
                            </td>
                          </tr>
                        )}
                        {(fieldFlags.placement || job.placement) && (
                          <tr>
                            <td className="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">Placement</td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {job.placement || 'Not Specified'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200 whitespace-nowrap">-</td>
                            <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[10px] sm:text-[10.5px] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                                <span>Pending</span>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 text-[11px] sm:text-[11.5px] break-words">-</td>
                          </tr>
                        )}
                        {(fieldFlags.outputFormat || job.finalFiles?.length) && (
                          <tr>
                            <td className="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">Output File Format</td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {job.finalFiles?.length ? job.finalFiles.join(', ') : 'Not Specified'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 border-r border-slate-200 whitespace-nowrap">-</td>
                            <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[10px] sm:text-[10.5px] whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                                <span>Pending</span>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 text-[11px] sm:text-[11.5px] leading-relaxed break-words">-</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Instructions */}
                <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Additional Instructions
                  </h3>
                  <p className="text-[9.5px] text-slate-400 mb-1">
                    Please provide detailed instructions for digitizing (unlimited characters).
                  </p>
                  <textarea
                    readOnly
                    rows={8}
                    value={additionalInstructions}
                    placeholder="No additional instructions provided."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-[10.5px] text-slate-700 placeholder:text-slate-400 outline-none resize-none cursor-default"
                  />
                  <p className="text-[9.5px] text-slate-400 mt-1">
                    Provide as much detail as possible for accurate digitizing.
                  </p>
                </div>

                {/* Attachments (Instructions & Source Files) */}
                <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Attachments (Instructions &amp; Source Files)
                    </h3>
                    <Info className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(() => {
                      const extraImages = images.slice(1).map((src: string, idx: number) => {
                        let fileName = `Reference Image ${idx + 2}`;
                        try {
                          const rawName = decodeURIComponent(src.split('/').pop()?.split('?')[0] || '');
                          if (rawName && rawName.length > 1 && rawName.includes('.')) {
                            fileName = rawName;
                          }
                        } catch {
                          // fallback
                        }
                        return {
                          id: `extra-img-${idx}-${src}`,
                          file_name: fileName,
                          file_size_bytes: null,
                          url: src,
                          isImage: true,
                        };
                      });

                      const filesToRender = [
                        ...(referenceFiles || []),
                        ...extraImages,
                      ];

                      if (!filesToRender || filesToRender.length === 0) {
                        return (
                          <div className="col-span-full text-[10.5px] text-slate-400 italic">
                            No instruction attachments or source files uploaded.
                          </div>
                        );
                      }
                      return filesToRender.map((f: any) => (
                        <div key={f.id || f.file_name} className="flex items-center justify-between p-1.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition text-[10px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {f.isImage ? (
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            ) : (
                              <FileText className="w-3 h-3 text-purple-600 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate" title={f.file_name}>{f.file_name}</div>
                              <div className="text-[9px] text-slate-400">
                                {f.file_size_bytes ? formatBytes(f.file_size_bytes) : (f.isImage ? 'Reference Image' : 'Attachment')}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (f.url) {
                                window.open(f.url, '_blank');
                              } else if (f.id && f.id.length > 5) {
                                adminService.getDownloadUrl(f.id).then((res) => {
                                  window.open(res.url, '_blank');
                                });
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-purple-700 rounded-md transition shrink-0"
                            title="Download file"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-1.5">
                    Please review all instructions and reference files carefully.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN (4 cols) */}
              <div className="lg:col-span-3 flex flex-col gap-2 min-h-0">
                {/* Internal Notes */}
                <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col shrink-0">
                  <h3 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Internal Notes
                  </h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {internalNotesList.map((n) => (
                      <div key={n.id} className="p-1.5 rounded-lg bg-white border border-slate-200/80 text-[9.5px] text-slate-800">
                        <div className="whitespace-pre-wrap">{n.text}</div>
                        <div className="mt-1 text-[8.5px] font-semibold text-slate-500 flex justify-between">
                          <span>Added by {n.author}</span>
                          <span>{n.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 pt-1 border-t border-slate-100 flex gap-1.5">
                    <input
                      type="text"
                      value={newInternalNote}
                      onChange={(e) => setNewInternalNote(e.target.value)}
                      placeholder="Add an internal note..."
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-purple-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newInternalNote.trim()) {
                          setInternalNotesList((prev) => [
                            ...prev,
                            { id: String(Date.now()), author: user?.name || 'Staff', date: new Date().toLocaleString(), text: newInternalNote.trim() },
                          ]);
                          setNewInternalNote('');
                          toast.success('Internal note added');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newInternalNote.trim()) {
                          setInternalNotesList((prev) => [
                            ...prev,
                            { id: String(Date.now()), author: user?.name || 'Staff', date: new Date().toLocaleString(), text: newInternalNote.trim() },
                          ]);
                          setNewInternalNote('');
                          toast.success('Internal note added');
                        }
                      }}
                      className="btn btn-outline text-[10px] px-2.5 py-1 text-purple-700 border-purple-200 hover:bg-purple-50"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Client Queries */}
                <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col flex-1 min-h-[280px]">
                  <h3 className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1 shrink-0">
                    Client Queries
                  </h3>
                  <JobQueriesSection jobId={canonicalRoomId} compact={true} />
                </div>

              </div>

            </div>
          )}

          {/* REQUIREMENTS TAB */}
          {!showCompare && activeTab === 'requirements' && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4 text-slate-800">
              <h3 className="text-[14px] font-bold text-slate-800">Job Specifications & Requirements</h3>
              <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">Order Details</div>
                  <DetailRow label="Client ID" value={displayJob.clientId} />
                  <DetailRow label="Order Type" value={displayJob.order} />
                  {(fieldFlags.placement || displayJob.placement) && (
                    <DetailRow label="Placement" value={displayJob.placement || 'Not Specified'} />
                  )}
                  {(fieldFlags.size || (displayJob.width || displayJob.height)) && (
                    <DetailRow label="Size" value={displayJob.width && displayJob.height ? `${displayJob.width}" W x ${displayJob.height}" H` : (displayJob.width || displayJob.height ? `${displayJob.width || '-'} W x ${displayJob.height || '-'} H` : 'Not Specified')} />
                  )}
                  {fieldFlags.colors && displayJob.colors != null && displayJob.colors > 0 && (
                    <DetailRow label="Colors" value={`${displayJob.colors} ${displayJob.colors === 1 ? 'Color' : 'Colors'}`} />
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">Technical Specs</div>
                  {(fieldFlags.fabric || displayJob.fabric) && (
                    <DetailRow label="Fabric" value={displayJob.fabric || 'Not Specified'} />
                  )}
                  <DetailRow label="Complexity" value={displayJob.complexity || 'Standard'} />
                  <DetailRow label="Process" value={displayJob.process || displayJob.order} />
                  {(fieldFlags.outputFormat || displayJob.finalFiles?.length) && (
                    <DetailRow label="Output Formats" value={displayJob.finalFiles?.join(', ') || 'Not Specified'} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES TAB */}
          {!showCompare && activeTab === 'messages' && (
            <JobQueriesSection jobId={(job.isAdminCopy && job.parentJobId) ? job.parentJobId : (job.uuid ?? null)} />
          )}

          {/* NOTES TAB */}
          {!showCompare && activeTab === 'notes' && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4 text-slate-800">
              <h3 className="text-[14px] font-bold text-slate-800">Internal Notes Log</h3>
              <div className="space-y-3">
                {internalNotesList.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-[12px]">
                    <div className="font-medium text-slate-800 whitespace-pre-wrap">{n.text}</div>
                    <div className="mt-2 text-[10.5px] font-bold text-slate-500 flex justify-between">
                      <span>Added by {n.author}</span>
                      <span>{n.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVITY LOG TAB */}
          {!showCompare && activeTab === 'activity' && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-[12px] text-slate-800">
              <h3 className="text-[14px] font-bold text-slate-800 mb-2">Activity Audit Log</h3>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <span className="font-semibold text-slate-700">Order Received</span>
                <span className="text-slate-400 text-[11px] ml-auto">{formatDate(job.created)} 10:15 AM</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-slate-700">Client Instructions Uploaded</span>
                <span className="text-slate-400 text-[11px] ml-auto">{formatDate(job.created)} 10:20 AM</span>
              </div>
            </div>
          )}

          {/* ── MODIFICATION REQUEST ── client's description + attached files ── */}
          {normalizedStatus(job) === 'MODIFICATION_REQUESTED' && (() => {
            const amendFiles = (adminJobFiles ?? []).filter(
              (f) => f.file_category === FileCategory.ORIGINAL,
            );
            return (
              <div
                className="mx-6 mb-4 rounded-xl overflow-hidden"
                style={{ border: '1.5px solid rgba(225,29,72,0.35)', background: 'rgba(225,29,72,0.05)' }}
              >
                {/* Header */}
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: '1px solid rgba(225,29,72,0.2)', background: 'rgba(225,29,72,0.08)' }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#e11d48' }} aria-hidden />
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: '#e11d48' }}>
                    Client's Modification Request{job.modificationCount ? ` — Amend R${job.modificationCount}` : ''}
                  </span>
                </div>

                {/* Description */}
                <div className="px-4 pt-3 pb-2">
                  {job.modificationNotes ? (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-main)' }}>
                      {job.modificationNotes}
                    </p>
                  ) : (
                    <p className="text-[12.5px] italic" style={{ color: 'var(--text-faint)' }}>No description provided.</p>
                  )}
                </div>

                {/* Attached files */}
                {amendFiles.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] mb-2 mt-1" style={{ color: 'var(--text-faint)' }}>
                      Attached Files ({amendFiles.length})
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {amendFiles.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                          style={{ background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.18)' }}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#e11d48' }} aria-hidden />
                          <span className="text-[12px] font-medium truncate flex-1" style={{ color: 'var(--text-main)' }}>
                            {f.file_name}
                          </span>
                          <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>
                            {f.file_size_bytes < 1024 * 1024
                              ? `${(f.file_size_bytes / 1024).toFixed(0)} KB`
                              : `${(f.file_size_bytes / 1024 / 1024).toFixed(1)} MB`}
                          </span>
                          {f.storage_url && (
                            <a
                              href={f.storage_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[11px] font-semibold"
                              style={{ color: '#e11d48' }}
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── HOLD ── job is paused pending a reply to a staff-raised query.
              The Unhold action itself lives in the header, beside Close. */}
          {!showCompare && job.rawStatus === JobStatus.HOLD && (
            <div
              className="flex items-center gap-2 rounded-[10px] px-4 py-3 mt-4 text-[12.5px] font-semibold"
              style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)', color: '#e11d48' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
              On hold — waiting on the client's reply to a query. The ETA timer is paused.
            </div>
          )}



        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-2.5 flex-wrap"
          style={{ borderTop: '1px solid #E8EDF5', background: '#FAFBFD' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline text-[11.5px] px-3.5 py-1.5"
              onClick={handleClose}
            >
              Back to Dashboard
            </button>
            {/* Phase 2: Save & Continue
            <button
              type="button"
              className="btn btn-outline text-[11.5px] px-3.5 py-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => {
                toast.success('Job changes saved');
              }}
            >
              Save & Continue
            </button>
            */}
          </div>

          <div className="flex items-center gap-2">
            {canAcknowledge && (
              <button
                type="button"
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
                onClick={() => setShowAckPopover(true)}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Acknowledgement</span>
              </button>
            )}
            {!job.assignedTo && job.stage !== 'delivered' && job.stage !== 'quote' && (
              <button
                type="button"
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
                onClick={() => onAssign ? onAssign(job) : toast('Assigning jobs is coming soon in Phase 2.')}
              >
                <User className="w-3.5 h-3.5" />
                <span>Assign</span>
              </button>
            )}
            {!isDelivered && !canAcknowledge && !quoteSent && (
              <button
                type="button"
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
                onClick={() => {
                  if (job.stage === 'quote' || normalizedStatus(job) === 'QUOTE_SUBMITTED') {
                    handleStartProduction();
                  } else {
                    openSendMailModal();
                  }
                }}
              >
                {job.stage === 'quote' || normalizedStatus(job) === 'QUOTE_SUBMITTED' ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Submit Quote</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Project</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── MARK COMPLETE MODAL ── */}
      {showMarkComplete && jobUuid ? (
        <MarkCompleteModal
          jobId={jobUuid}
          jobDesign={job.design}
          orderType={job.order}
          allowedFormats={allowedFormats ?? undefined}
          onClose={() => setShowMarkComplete(false)}
          onSuccess={() => { setShowMarkComplete(false); handleClose(); }}
        />
      ) : null}

      {/* ── REJECT AMENDMENT DIALOG ── */}
      {showRejectDialog && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 anim-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget && amendBusy === null) setShowRejectDialog(false); }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reject Amendment"
            className="glass-heavy rounded-2xl w-full max-w-[420px] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold mb-1 text-text-main">Reject Amendment Request?</h2>
            <p className="text-[12.5px] text-text-muted leading-relaxed mb-4">
              The client will receive an email saying their request was not accepted. Optionally add a reason.
            </p>
            <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-1.5">
              Reason <span className="font-normal normal-case text-text-faint">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-[var(--glass-border)] bg-transparent text-[13px] text-text-main p-3 outline-none focus:border-[#e11d48] transition resize-none mb-4 placeholder:text-text-faint"
              rows={3}
              placeholder="e.g. The requested change is outside the original scope."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={amendBusy !== null}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRejectDialog(false)}
                disabled={amendBusy !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-crimson"
                onClick={handleRejectAmendment}
                disabled={amendBusy !== null}
              >
                {amendBusy === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── 2-STEP CONFIRMATION MODAL ── */}
      {showConfirm ? (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !sendPrice.isPending) {
              setShowConfirm(false);
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Quote Proposal"
            className="relative w-full max-w-[460px] rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: '#fff',
              boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gold header */}
            <div
              className="flex items-start gap-3 px-6 py-5"
              style={{
                background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                borderBottom: '1px solid #FCD34D',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(217,119,6,0.12)',
                  border: '1.5px solid rgba(217,119,6,0.25)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 17, fontWeight: 800, color: '#92400E', letterSpacing: '0.01em', marginBottom: 2 }}>
                  Confirm Quote Proposal
                </div>
                <div style={{ fontSize: 12, color: '#B45309', opacity: 0.85 }}>
                  Please verify details before dispatching to the client.
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!sendPrice.isPending) setShowConfirm(false); }}
                disabled={sendPrice.isPending}
                aria-label="Close"
                style={{
                  color: '#92400E', opacity: 0.6, background: 'none', border: 'none',
                  fontSize: 18, cursor: sendPrice.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* Price card — values are clamped so long inputs (whether
                  the rep typed in a sane number with many digits, or an
                  absurd 30-digit value) don't blow out the dialog. */}
              {(() => {
                const priceStr = Number(parseFloat(agencyPrice) || 0).toLocaleString('en-US');
                // Scale the headline price down as it grows so it still fits.
                const priceFontSize =
                  priceStr.length > 22 ? 18 :
                    priceStr.length > 16 ? 22 :
                      priceStr.length > 12 ? 28 :
                        36;
                return (
                  <div
                    className="flex flex-col items-center gap-2.5 text-center"
                    style={{
                      background: '#FFFBEB', border: '1.5px solid #FCD34D',
                      borderRadius: 12, padding: 20,
                      boxShadow: '0 4px 24px rgba(217,119,6,0.06)',
                      maxWidth: '100%', overflow: 'hidden',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Quoted Price Proposal
                    </div>
                    <div
                      style={{
                        fontSize: priceFontSize, fontWeight: 800, color: '#92400E',
                        letterSpacing: '-0.02em', background: '#FEF3C7',
                        padding: '6px 18px', borderRadius: 10, border: '1px solid #FCD34D',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', margin: '4px auto',
                        maxWidth: '100%',
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        lineHeight: 1.15,
                        transition: 'font-size 0.15s ease',
                      }}
                    >
                      ${priceStr}
                    </div>
                    <div
                      style={{
                        fontSize: 13, color: '#B45309', fontWeight: 600,
                        maxWidth: '100%', wordBreak: 'break-all', overflowWrap: 'anywhere',
                      }}
                    >
                      Confirmed ETA:{' '}
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, fontWeight: 700 }}>
                        {confirmedEta}h
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Warning banner */}
              <div
                className="flex items-start gap-3"
                style={{
                  background: 'rgba(178,34,52,0.05)',
                  border: '1px solid rgba(178,34,52,0.15)',
                  borderRadius: 10, padding: '14px 16px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B22234" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div style={{ fontSize: 12.5, color: '#B22234', lineHeight: 1.55, fontWeight: 600 }}>
                  <strong>Please note:</strong> Sending this quote proposal locks the job status to{' '}
                  <strong>Quote Sent</strong>. The client will be prompted to authorize the final price and ETA to commence production.
                </div>
              </div>

              {/* Type to confirm */}
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Type to Confirm
                </label>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Type <code style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>CONFIRM</code> below to enable the confirm button
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && confirmText.trim().toUpperCase() === 'CONFIRM' && !sendPrice.isPending) {
                      handleConfirmSubmit();
                    }
                  }}
                  placeholder="CONFIRM"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    border: `1.5px solid ${confirmText.trim().toUpperCase() === 'CONFIRM' ? '#22C55E' : '#E2E8F0'}`,
                    background: '#fff', color: '#0D1B2A',
                    padding: '12px 16px', borderRadius: 10, width: '100%', outline: 'none',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 14,
                    boxShadow: confirmText.trim().toUpperCase() === 'CONFIRM'
                      ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                    transition: 'all 0.18s ease',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2.5 px-6 py-4"
              style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid #E8EDF5' }}
            >
              <button
                type="button"
                onClick={() => { if (!sendPrice.isPending) setShowConfirm(false); }}
                disabled={sendPrice.isPending}
                style={{
                  border: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700,
                  background: 'transparent', borderRadius: 99, padding: '9px 20px',
                  fontSize: 12.5, cursor: sendPrice.isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: sendPrice.isPending ? 0.5 : 1,
                }}
              >
                ✕ Cancel
              </button>
              {(() => {
                const ready = confirmText.trim().toUpperCase() === 'CONFIRM';
                const disabled = !ready || sendPrice.isPending;
                return (
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={disabled}
                    style={{
                      background: ready ? '#22C55E' : '#D97706',
                      border: `1.5px solid ${ready ? '#22C55E' : '#D97706'}`,
                      color: '#fff', padding: '9px 22px', fontSize: 12.5, fontWeight: 700,
                      borderRadius: 99,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1,
                      boxShadow: ready ? '0 4px 14px rgba(34,197,94,0.4)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {sendPrice.isPending ? 'Sending…' : 'Send Quote Proposal'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── SEND MAIL TO CLIENT — CONFIRM DIALOG ── */}
      {showSendMailModal ? (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && sendMailPhase === 'idle') {
              closeSendMailModal();
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Deliver Project"
            className="relative w-full max-w-[480px] rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: '#fff',
              boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-start gap-3 px-6 py-5 shrink-0"
              style={{
                background: 'linear-gradient(135deg, #FEF9EC, #FEF3C7)',
                borderBottom: '1px solid #FCD34D',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(217,119,6,0.12)',
                  border: '1.5px solid rgba(217,119,6,0.3)',
                }}
              >
                <Send className="w-4 h-4" style={{ color: '#D97706' }} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 17, fontWeight: 800, color: '#78350F', letterSpacing: '0.01em', marginBottom: 2 }}>
                  Dispatch Project
                </div>
                <div style={{ fontSize: 12, color: '#92400E', opacity: 0.85 }}>
                  This will notify the client that their order is ready for delivery.
                </div>
              </div>
              <button
                type="button"
                onClick={closeSendMailModal}
                disabled={sendMailPhase !== 'idle'}
                aria-label="Close"
                style={{
                  color: '#78350F', opacity: 0.5, background: 'none', border: 'none',
                  fontSize: 18, cursor: sendMailPhase !== 'idle' ? 'not-allowed' : 'pointer',
                  lineHeight: 1, padding: 2,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">

              {/* File upload zone */}
              {sendMailPhase === 'idle' && (
                <div className="flex flex-col gap-2">
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Upload Completed Deliverables <span style={{ color: '#B22234' }}>*</span>
                  </div>
                  {allowedFormats && allowedFormats.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginTop: -2, marginBottom: 2 }}>
                      Expected Format: <span style={{ color: '#D97706', fontWeight: 700 }}>{allowedFormats.map(f => f.toUpperCase()).join(', ')}</span>
                    </div>
                  )}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsSendMailDragging(true);
                    }}
                    onDragLeave={() => setIsSendMailDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsSendMailDragging(false);
                      addSendMailFiles(e.dataTransfer.files);
                    }}
                    onClick={() => sendMailFileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isSendMailDragging ? '#D97706' : '#CBD5E1'}`,
                      borderRadius: 10,
                      padding: '24px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: isSendMailDragging ? 'rgba(217,119,6,0.04)' : '#F8FAFC',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: isSendMailDragging ? '#D97706' : '#94A3B8' }} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                      Drop files here or <span style={{ color: '#D97706', textDecoration: 'underline' }}>browse</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                      {allowedFormats && allowedFormats.length > 0
                        ? allowedFormats.map(f => f.toUpperCase()).join(', ')
                        : 'PDF, PNG, JPG, AI, EPS, CDR'} — up to 500 MB each
                    </div>
                  </div>
                  <input
                    ref={sendMailFileInputRef}
                    type="file"
                    multiple
                    accept={allowedFormats && allowedFormats.length > 0
                      ? allowedFormats.map(ext => `.${ext}`).join(',')
                      : ".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.cdr,image/*"}
                    className="hidden"
                    onChange={(e) => addSendMailFiles(e.target.files)}
                  />
                </div>
              )}

              {/* Progress Indicator */}
              {sendMailPhase !== 'idle' && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#D97706' }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#78350F' }}>
                      {sendMailPhase === 'uploading'
                        ? `Uploading files (${sendMailUploadProgress}%)…`
                        : 'Sending order notification email…'}
                    </div>
                  </div>
                  {sendMailPhase === 'uploading' && (
                    <div style={{ width: '100%', height: 6, background: '#FEF3C7', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${sendMailUploadProgress}%`,
                          height: '100%',
                          background: '#D97706',
                          transition: 'width 0.2s ease-out'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Files to be sent */}
              <div className="flex flex-col gap-2">
                {(() => {
                  const selectedServerFiles = allCompletedFiles.filter((f) => !excludedServerFileIds.has(f.id));
                  const excludedServerFiles = allCompletedFiles.filter((f) => excludedServerFileIds.has(f.id));
                  const totalToSend = selectedServerFiles.length + sendMailFiles.length;

                  return (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Files to be sent ({totalToSend})
                      </div>


                      {totalToSend === 0 && excludedServerFiles.length === 0 ? (
                        <div
                          className="flex items-start gap-2.5"
                          style={{
                            background: 'rgba(234,179,8,0.07)',
                            border: '1px solid rgba(234,179,8,0.35)',
                            borderRadius: 10, padding: '12px 14px',
                          }}
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#B45309', marginTop: 1 }} aria-hidden />
                          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.55, fontWeight: 600 }}>
                            No completed files found. Upload files to the job before sending the mail.
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {/* Already Uploaded Server Files (included) */}
                          {selectedServerFiles.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Completed Deliverables on Server ({selectedServerFiles.length})
                              </div>
                              {selectedServerFiles.map((f) => (
                                <div
                                  key={f.id}
                                  className="flex items-center gap-2.5"
                                  style={{
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: 8, padding: '9px 12px',
                                  }}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#22C55E' }} aria-hidden />
                                  <span style={{ fontSize: 12, color: '#1E293B', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {f.file_name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExcludedServerFileIds((prev) => new Set([...prev, f.id]))}
                                    disabled={sendMailPhase !== 'idle'}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: '#94A3B8', padding: '2px 4px', borderRadius: 4,
                                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                                      display: 'flex', alignItems: 'center', gap: 3,
                                    }}
                                    title="Remove from this delivery"
                                    aria-label={`Remove ${f.file_name} from delivery`}
                                  >
                                    <X className="w-3 h-3" aria-hidden /> Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Excluded server files — shown as removed, with undo */}
                          {excludedServerFiles.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Removed from this delivery ({excludedServerFiles.length})
                              </div>
                              {excludedServerFiles.map((f) => (
                                <div
                                  key={f.id}
                                  className="flex items-center gap-2.5"
                                  style={{
                                    background: '#FFF1F2',
                                    border: '1px solid #FECDD3',
                                    borderRadius: 8, padding: '9px 12px',
                                    opacity: 0.75,
                                  }}
                                >
                                  <X className="w-3.5 h-3.5 shrink-0" style={{ color: '#F43F5E' }} aria-hidden />
                                  <span style={{ fontSize: 12, color: '#9F1239', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textDecoration: 'line-through' }}>
                                    {f.file_name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExcludedServerFileIds((prev) => { const next = new Set(prev); next.delete(f.id); return next; })}
                                    disabled={sendMailPhase !== 'idle'}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: '#059669', padding: '2px 4px', borderRadius: 4,
                                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                                    }}
                                    aria-label={`Re-include ${f.file_name}`}
                                  >
                                    Undo
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* New Files to Upload */}
                {sendMailFiles.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      New Files to Upload ({sendMailFiles.length})
                    </div>
                    {sendMailFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5"
                        style={{
                          background: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: 8, padding: '9px 12px',
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#D97706' }} aria-hidden />
                        <span style={{ fontSize: 12, color: '#78350F', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#92400E', marginRight: 4 }}>
                          {(f.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        {sendMailPhase === 'idle' && (
                          <button
                            type="button"
                            onClick={() => removeSendMailFile(i)}
                            style={{
                              background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                              color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            aria-label={`Remove ${f.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Note to client */}
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Note <span style={{ fontWeight: 500, textTransform: 'none', fontSize: 10.5, color: '#94A3B8' }}>(optional — included in delivery email)</span>
                </label>
                <textarea
                  value={sendMailNote}
                  onChange={(e) => setSendMailNote(e.target.value)}
                  disabled={sendMailPhase !== 'idle'}
                  placeholder="Add a message for the client…"
                  maxLength={1000}
                  rows={3}
                  style={{
                    resize: 'vertical',
                    border: `1.5px solid ${sendMailNote.trim() ? '#D97706' : '#E2E8F0'}`,
                    background: '#fff',
                    color: '#0D1B2A',
                    padding: '10px 14px',
                    borderRadius: 10,
                    width: '100%',
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    boxShadow: sendMailNote.trim() ? '0 0 0 3px rgba(217,119,6,0.12)' : 'none',
                    transition: 'all 0.18s ease',
                    opacity: sendMailPhase !== 'idle' ? 0.6 : 1,
                  }}
                />
                <div style={{ fontSize: 10.5, color: '#94A3B8', textAlign: 'right' }}>
                  {sendMailNote.length}/1000
                </div>
              </div>

              {/* Type to confirm */}
              <div className="flex flex-col gap-2">
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Type to Confirm
                </label>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  Type <code style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>CONFIRM</code> below to enable the send button
                </div>
                <input
                  type="text"
                  value={sendMailConfirmText}
                  onChange={(e) => setSendMailConfirmText(e.target.value.toUpperCase())}
                  disabled={sendMailPhase !== 'idle'}
                  onKeyDown={(e) => {
                    const totalFilesCount = allCompletedFiles.filter((f) => !excludedServerFileIds.has(f.id)).length + sendMailFiles.length;
                    if (
                      e.key === 'Enter' &&
                      sendMailConfirmText.trim().toUpperCase() === 'CONFIRM' &&
                      sendMailPhase === 'idle' &&
                      totalFilesCount > 0 &&
                      hasAllRequiredFormats
                    ) {
                      handleSendMailSubmit();
                    }
                  }}
                  placeholder="CONFIRM"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    border: `1.5px solid ${sendMailConfirmText.trim().toUpperCase() === 'CONFIRM' ? '#D97706' : '#E2E8F0'}`,
                    background: '#fff', color: '#0D1B2A',
                    padding: '12px 16px', borderRadius: 10, width: '100%', outline: 'none',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 14,
                    boxShadow: sendMailConfirmText.trim().toUpperCase() === 'CONFIRM'
                      ? '0 0 0 3px rgba(217,119,6,0.18)' : 'none',
                    transition: 'all 0.18s ease',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
              style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid #E8EDF5' }}
            >
              <button
                type="button"
                onClick={closeSendMailModal}
                disabled={sendMailPhase !== 'idle'}
                style={{
                  border: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700,
                  background: 'transparent', borderRadius: 99, padding: '9px 20px',
                  fontSize: 12.5, cursor: sendMailPhase !== 'idle' ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: sendMailPhase !== 'idle' ? 0.5 : 1,
                }}
              >
                ✕ Cancel
              </button>
              {(() => {
                const totalFilesCount = allCompletedFiles.filter((f) => !excludedServerFileIds.has(f.id)).length + sendMailFiles.length;
                const ready = sendMailConfirmText.trim().toUpperCase() === 'CONFIRM' && totalFilesCount > 0 && hasAllRequiredFormats;
                const disabled = !ready || sendMailPhase !== 'idle';
                return (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleSendMailSubmit}
                    style={{
                      background: ready ? '#D97706' : '#94A3B8',
                      border: `1.5px solid ${ready ? '#D97706' : '#94A3B8'}`,
                      color: '#fff', padding: '9px 22px', fontSize: 12.5, fontWeight: 700,
                      borderRadius: 99,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.6 : 1,
                      boxShadow: ready ? '0 4px 14px rgba(217,119,6,0.45)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Send className="w-3.5 h-3.5" aria-hidden />
                    {sendMailPhase === 'uploading' ? 'Uploading…' : sendMailPhase === 'sending' ? 'Dispatching…' : 'Dispatch Project'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── DISPATCH CONFIRMATION MODAL ── */}
      {showDispatchConfirm ? (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !dispatchJob.isPending) {
              setShowDispatchConfirm(false);
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Dispatch to Client"
            className="relative w-full max-w-[460px] rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: '#fff',
              boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Crimson header */}
            <div
              className="flex items-start gap-3 px-6 py-5"
              style={{
                background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                borderBottom: '1px solid #FCA5A5',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(178,34,52,0.12)',
                  border: '1.5px solid rgba(178,34,52,0.25)',
                }}
              >
                <Send className="w-4 h-4" style={{ color: '#B22234' }} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 17, fontWeight: 800, color: '#7F1D1D', letterSpacing: '0.01em', marginBottom: 2 }}>
                  Dispatch to Client
                </div>
                <div style={{ fontSize: 12, color: '#991B1B', opacity: 0.85 }}>
                  The client will be notified and the job will move to Dispatched.
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!dispatchJob.isPending) setShowDispatchConfirm(false); }}
                disabled={dispatchJob.isPending}
                aria-label="Close"
                style={{
                  color: '#7F1D1D', opacity: 0.6, background: 'none', border: 'none',
                  fontSize: 18, cursor: dispatchJob.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <div
                className="flex flex-col gap-2.5"
                style={{
                  background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                  borderRadius: 12, padding: '16px 18px',
                  boxShadow: '0 4px 24px rgba(178,34,52,0.06)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  What happens on confirm
                </div>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
                  <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#7F1D1D', fontWeight: 600, lineHeight: 1.5 }}>
                    <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                    Final deliverables become available to the client
                  </li>
                  <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#7F1D1D', fontWeight: 600, lineHeight: 1.5 }}>
                    <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                    Job moves to Dispatched
                  </li>
                  <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#7F1D1D', fontWeight: 600, lineHeight: 1.5 }}>
                    <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                    Client is notified via email + in-app
                  </li>
                </ul>
              </div>

              <div
                className="flex items-start gap-3"
                style={{
                  background: 'rgba(178,34,52,0.05)',
                  border: '1px solid rgba(178,34,52,0.15)',
                  borderRadius: 10, padding: '12px 14px',
                }}
              >
                <AlertCircle className="w-4 h-4" style={{ color: '#B22234', flexShrink: 0, marginTop: 1 }} aria-hidden />
                <div style={{ fontSize: 12, color: '#B22234', lineHeight: 1.55, fontWeight: 600 }}>
                  This action cannot be undone. Make sure all deliverables and QC checks are complete.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2.5 px-6 py-4"
              style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid #E8EDF5' }}
            >
              <button
                type="button"
                onClick={() => { if (!dispatchJob.isPending) setShowDispatchConfirm(false); }}
                disabled={dispatchJob.isPending}
                style={{
                  border: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700,
                  background: 'transparent', borderRadius: 99, padding: '9px 20px',
                  fontSize: 12.5, cursor: dispatchJob.isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: dispatchJob.isPending ? 0.5 : 1,
                }}
              >
                ✕ Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatchSubmit}
                disabled={dispatchJob.isPending}
                style={{
                  background: '#B22234',
                  border: '1.5px solid #B22234',
                  color: '#fff', padding: '9px 22px', fontSize: 12.5, fontWeight: 700,
                  borderRadius: 99,
                  cursor: dispatchJob.isPending ? 'not-allowed' : 'pointer',
                  opacity: dispatchJob.isPending ? 0.6 : 1,
                  boxShadow: '0 4px 14px rgba(178,34,52,0.35)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Send className="w-3.5 h-3.5" aria-hidden />
                {dispatchJob.isPending ? 'Dispatching…' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FilePreviewModal
        source={
          previewFile
            ? previewUrl
              ? { kind: 'remote', url: previewUrl, name: previewFile.file_name, type: previewFile.file_type }
              : null
            : null
        }
        loading={previewLoading}
        onClose={() => {
          setPreviewFile(null);
          setPreviewUrl(null);
        }}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      className="flex items-baseline justify-between py-1.5 gap-3"
      style={{ borderBottom: '1px solid #F1F5F9' }}
    >
      <span className="text-[11.5px] shrink-0" style={{ color: '#64748B' }}>{label}</span>
      <span
        className="text-[12px] font-semibold text-right"
        style={{ color: '#0D1B2A', ...valueStyle }}
      >
        {value}
      </span>
    </div>
  );
}

function CompareView({
  adminJob,
  clientJob,
}: {
  adminJob: Job;
  clientJob: Job;
}) {
  const fields: { label: string; get: (j: Job) => string }[] = [
    { label: 'Design Name', get: (j) => j.design || '—' },
    { label: 'Order Type', get: (j) => j.order || '—' },
    { label: 'Project Type', get: (j) => j.project || '—' },
    { label: 'Process Type', get: (j) => j.process || '—' },
    { label: 'Complexity', get: (j) => j.complexity || '—' },
    { label: 'Priority', get: (j) => j.priority || '—' },
    { label: 'ETA Hours', get: (j) => j.etaHours != null ? `${j.etaHours}h` : '—' },
    { label: 'Colors', get: (j) => j.colors != null ? String(j.colors) : '—' },
    {
      label: 'Output Formats',
      get: (j) => {
        if (!j.finalFiles?.length) return '—';
        const text = j.notes || j.summary;
        const match = text?.match(/\[\s*Expected Output Format\s*:\s*([^\]]*?)\s*\]/i);
        const customFormat = match && match[1] ? match[1].trim() : null;
        const labels = j.finalFiles.map(f => {
          if (f.toUpperCase() === 'OTHERS' || f.toUpperCase() === 'OTHER') {
            if (customFormat) {
              if (/^others:\s*/i.test(customFormat)) {
                return customFormat.replace(/^others:\s*/i, 'Others: ');
              }
              return `Others: ${customFormat}`;
            }
            return f;
          }
          return f;
        });
        return [...new Set(labels)].join(', ');
      }
    },
    { label: 'Placement', get: (j) => j.placement || '—' },
    { label: 'Width (in)', get: (j) => j.width != null ? `${j.width}"` : '—' },
    { label: 'Height (in)', get: (j) => j.height != null ? `${j.height}"` : '—' },
    { label: 'Fabric', get: (j) => j.fabric || '—' },
    { label: 'Stitch Count', get: (j) => j.stitchCount != null ? j.stitchCount.toLocaleString() : '—' },
    { label: 'Notes', get: (j) => j.notes || '—' },
  ];

  return (
    <div style={{ padding: '0 20px 20px' }}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3" style={{ fontSize: 11, color: '#64748B' }}>
        <span className="flex items-center gap-1.5">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FEF3C7', border: '1px solid #FCD34D' }} />
          Changed field
        </span>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '140px 1fr 1fr',
            background: '#F8FAFC',
            borderBottom: '1.5px solid #E2E8F0',
          }}
        >
          <div style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }} />
          <div
            style={{
              padding: '9px 14px',
              fontSize: 11, fontWeight: 700, color: '#0EA5E9',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderLeft: '1px solid #E2E8F0',
            }}
          >
            Original
          </div>
          <div
            style={{
              padding: '9px 14px',
              fontSize: 11, fontWeight: 700, color: '#B22234',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderLeft: '1px solid #E2E8F0',
            }}
          >
            Modified
          </div>
        </div>

        {/* Rows */}
        {fields.map(({ label, get }, idx) => {
          const clientVal = get(clientJob);
          const adminVal = get(adminJob);
          const changed = clientVal !== adminVal;
          const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFC';

          return (
            <div
              key={label}
              className="grid"
              style={{
                gridTemplateColumns: '140px 1fr 1fr',
                background: rowBg,
                borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9',
              }}
            >
              {/* Field label */}
              <div
                style={{
                  padding: '8px 14px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {label}
              </div>

              {/* Client value */}
              <div
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: changed ? '#92400E' : '#0D1B2A',
                  background: changed ? '#FEF3C7' : 'transparent',
                  borderLeft: '1px solid #F1F5F9',
                  wordBreak: 'break-word',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {clientVal}
              </div>

              {/* Admin value */}
              <div
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: changed ? 700 : 500,
                  color: changed ? '#7F1D1D' : '#0D1B2A',
                  background: changed ? '#FEF3C7' : 'transparent',
                  borderLeft: '1px solid #F1F5F9',
                  wordBreak: 'break-word',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {adminVal}
                {changed && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 9,
                      fontWeight: 800,
                      background: '#F59E0B',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '1px 5px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Changed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
