import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JobQueriesSection } from './JobQueriesSection';
import { X, Download, Edit2, Send, AlertCircle, ChevronLeft, ChevronRight, Timer, CheckCircle2, PackageCheck, FileText, Upload, Loader2 } from 'lucide-react';
import { MarkCompleteModal } from '@modules/cs-panel/components/MarkCompleteModal';
import toast from 'react-hot-toast';
import { cn } from '@lib/utils';
import { type Job, jobImage } from '../mocks/jobs';
import { useSendQuotePrice, useRejectQuote, useDispatchJob, useAcknowledgeJob, useNotifyOrderReady } from '@/modules/cs-panel/hooks/use-cs-quote';
import { uploadCompletedFile } from '@modules/cs-panel/services/cs-quote.service';

import { useJobRoom } from '@lib/use-job-room';
import { useAdminJobById, useAdminJobFiles, useAdminJobImageUrls, isAdminViewableImage } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { FileCategory } from '@contracts';

/** Compute hh:mm:ss remaining from an ISO start timestamp + duration hours. */
function computeEtaCountdown(acknowledgedAt: string, etaHours: number): { display: string; expired: boolean } {
  const startMs = new Date(acknowledgedAt).getTime();
  const endMs = startMs + etaHours * 60 * 60 * 1000;
  const remaining = Math.max(0, endMs - Date.now());
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

function useEtaCountdown(acknowledgedAt: string | null | undefined, etaHours: number | null | undefined) {
  const active = !!(acknowledgedAt && etaHours != null && etaHours > 0);
  const [state, setState] = useState(() =>
    active ? computeEtaCountdown(acknowledgedAt!, etaHours!) : null,
  );
  useEffect(() => {
    if (!active) { setState(null); return; }
    setState(computeEtaCountdown(acknowledgedAt!, etaHours!));
    const id = setInterval(() => {
      const next = computeEtaCountdown(acknowledgedAt!, etaHours!);
      setState(next);
      if (next.expired) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [active, acknowledgedAt, etaHours]);
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

function buildFlowSteps(): { role: string; sub: string }[] {
  return [
    { role: 'Client Servicing', sub: 'Created' },
    { role: 'In Production', sub: 'Pending' },
    { role: 'Client Servicing', sub: 'Dispatch' },
  ];
}

function currentStepIndex(job: Job): number {
  switch (job.stage) {
    case 'quote': return 0;
    case 'delivered': return 2;
    default: return 1;
  }
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
    'In QC': 'teal', 'In Production': 'amber', Pending: 'blue', 'Senior Review': 'purple',
    Sewout: 'purple', 'Ready to Deliver': 'teal', Delivered: 'green',
    'Quote Submitted': 'blue', 'Quote Approved': 'amber',
    'Pending Client Confirm': 'amber', Cancelled: 'gray',
    Amend: 'amber', 'In Review': 'purple',
  };
  return map[status] ?? 'gray';
}

function priorityClass(priority: string): string {
  const map: Record<string, string> = {
    Normal: 'normal', Rush: 'rush', 'Super Rush': 'super-rush',
  };
  return map[priority] ?? 'normal';
}

function normalizedStatus(job: Job): string {
  // Prefer the raw backend enum carried by the adapter; fall back to the
  // UI-friendly `status` for mock data. Both paths normalize to the
  // `JOB_STATUS_NAME` shape so callers can compare against backend enums.
  return (job.rawStatus ?? job.status).toUpperCase().replace(/\s+/g, '_');
}

function isQuoteStageStatus(job: Job): boolean {
  const s = normalizedStatus(job);
  return s === 'QUOTE_SUBMITTED' || s === 'QUOTE_APPROVED';
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

function isReadyToDeliverStatus(job: Job): boolean {
  return normalizedStatus(job) === 'READY_TO_DELIVER';
}

export function JobDetailModal({ job, onClose, onEdit, quoteView = false }: JobDetailModalProps) {
  const [isIn, setIsIn] = useState(false);
  const [agencyPrice, setAgencyPrice] = useState('');
  const [confirmedEta, setConfirmedEta] = useState('');
  const [noteToClient, setNoteToClient] = useState('');
  // Field-specific invalid flags so the error message + border colour
  // can call out exactly which input is missing, instead of the old
  // single boolean that always read "Please enter a valid quoted price"
  // even when the price was fine and only the ETA was empty.
  const [priceInvalid, setPriceInvalid] = useState(false);
  const [etaInvalid, setEtaInvalid] = useState(false);
  const [carPage, setCarPage] = useState(0);
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

  const closeSendMailModal = () => {
    setShowSendMailModal(false);
    setSendMailConfirmText('');
    setSendMailFiles([]);
    setSendMailPhase('idle');
    setSendMailUploadProgress(0);
    setIsSendMailDragging(false);
    setSendMailNote('');
  };

  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [showAckPopover, setShowAckPopover] = useState(false);
  const [ackEtaHours, setAckEtaHours] = useState(() =>
    job?.etaHours != null ? String(job.etaHours) : '',
  );
  // Toggle between admin-edited and original client data (admin copies only).
  const [viewMode, setViewMode] = useState<'admin' | 'client'>('admin');
  // Side-by-side compare mode (admin copies only).
  const [showCompare, setShowCompare] = useState(false);

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
  const rejectQuote = useRejectQuote();
  const dispatchJob = useDispatchJob();
  const acknowledgeJob = useAcknowledgeJob();
  const notifyOrderReady = useNotifyOrderReady();
  const isSubmitting = sendPrice.isPending || rejectQuote.isPending;

  const etaCountdown = useEtaCountdown(job?.acknowledgedAt, job?.etaHours);

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
    const text = (job?.notes || '') + '\n' + (job?.summary || '') + '\n' + (originalJob?.notes || '') + '\n' + (originalJob?.summary || '');
    const match = text.match(/\[\s*Expected Output Format\s*:\s*([^\]]*?)\s*\]/i);
    if (!match || !match[1]) return null;
    const formatStr = match[1].trim().toLowerCase().replace(/^others:\s*/i, '');
    return formatStr
      .split(/[\s,;/\\|+]+/i)
      .map(s => s.trim().replace(/^\./, ''))
      .filter(Boolean);
  }, [job, originalJob]);

  if (!job) return null;

  // The data source for all detail fields. Toggle switches this between
  // the admin-edited copy and the original client submission.
  const showToggle = job.isAdminCopy === true;
  const displayJob: Job = showToggle && viewMode === 'client' && originalJob ? originalJob : job;

  const flowSteps = buildFlowSteps();
  const stepIdx = currentStepIndex(job);

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
        : [jobImage(displayJob, 0, 560, 420)];

  const clientBudget = displayJob.negotiation?.clientOffer ?? displayJob.clientPrice ?? null;
  const adminCounter = displayJob.negotiation?.agencyOffer ?? displayJob.adminPrice ?? null;
  const agreedPrice = displayJob.negotiation?.finalPrice ?? displayJob.agreedPrice ?? null;

  // Whether the quote has already been priced & sent (status QUOTE_APPROVED).
  // Drives readonly fields and swaps the action buttons for a clear
  // "awaiting client" banner instead of letting the rep submit a second
  // price for the same quote.
  const quoteSent = isQuoteAlreadySent(job);

  const aiOverall = displayJob.aiScore
    ? Math.round((displayJob.aiScore.colour + displayJob.aiScore.align + displayJob.aiScore.res + displayJob.aiScore.brief) / 4)
    : null;
  const aiPass = aiOverall !== null ? aiOverall >= 80 : null;

  // Quote popup is decided by CONTEXT (the Quotes page passes quoteView),
  // NOT by job.stage — otherwise quote-stage jobs in the Jobs lists would
  // wrongly open the quote popup.
  const isQuote = quoteView && isQuoteStageStatus(job);
  const isReadyToDeliver = isReadyToDeliverStatus(job);
  const isCsApproved = normalizedStatus(job) === 'CS_APPROVED';
  const canAcknowledge = normalizedStatus(job) === 'JOB_PLACED' && !job.acknowledgedAt;
  const isAcknowledged = !!job.acknowledgedAt;
  const isDelivered = normalizedStatus(job) === 'DELIVERED';

  // Workflow "current" node is blue ONLY on the quote popup; every other
  // popup keeps the original crimson so non-quote popups are unchanged.
  const curBorder = isQuote ? '#2563EB' : '#B22234';
  const curBg = isQuote ? '#EBF0FA' : '#fff';
  const curGlow = isQuote ? 'rgba(37,99,235,0.12)' : 'rgba(178,34,52,0.1)';

  const jobUuid = job.uuid;
  const requireUuid = (action: string): string | null => {
    if (!jobUuid) {
      toast.error(`Cannot ${action}: this job is missing its backend UUID. Refresh and try again.`);
      return null;
    }
    return jobUuid;
  };

  // Reasonable ceilings so the rep can't push obviously-bogus numbers
  // through (which also kept the confirm card from overflowing).
  const MAX_PRICE = 10_000_000;        // $10M — actual value cap
  const MAX_ETA_HOURS = 720;           // 30 days — actual value cap

  // Length caps prevent pathological inputs like "44444…" (50+ chars).
  // They're deliberately higher than what the value cap allows so the
  // user can still see a number that's over the real cap and correct it.
  const MAX_PRICE_LEN = 12;            // up to e.g. "999999999.99" — well past $10M
  const MAX_ETA_LEN = 5;               // up to "999.5" — well past 720

  /** Strip leading zeros, trim to `maxLen` chars. Allows one decimal point. */
  const trimNumeric = (raw: string, maxLen: number): string => {
    // Keep digits + a single decimal point only.
    let cleaned = raw.replace(/[^\d.]/g, '');
    // Collapse multiple dots: keep the first, drop the rest.
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    return cleaned.slice(0, maxLen);
  };

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

    if (allCompletedFiles.length + sendMailFiles.length === 0) {
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
      return;
    }

    setSendMailPhase('sending');
    const existingFileIds = allCompletedFiles.map((f) => f.id);
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

  const handleDownloadAllFiles = async () => {
    const filesToDownload = [
      ...(adminJobFiles ?? []),
      ...(clientJobFiles ?? [])
    ];
    const uniqueFiles = filesToDownload.filter(
      (f, index, self) => self.findIndex((u) => u.id === f.id) === index
    );

    if (uniqueFiles.length === 0) {
      toast.error('No files available for this job.');
      return;
    }

    const toastId = toast.loading(`Preparing to download ${uniqueFiles.length} file(s)…`);
    try {
      for (const f of uniqueFiles) {
        const res = await adminService.getDownloadUrl(f.id);
        try {
          // Fetch as blob so the browser triggers a real save-to-disk download
          // instead of navigating to the S3 URL (cross-origin URLs ignore the
          // download attribute and just open in a new tab).
          const response = await fetch(res.url);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = f.file_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Fallback: open in new tab if blob fetch fails
          window.open(res.url, '_blank', 'noopener,noreferrer');
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      toast.success('Downloads started successfully.', { id: toastId });
    } catch (err) {
      toast.error('Failed to download files.', { id: toastId });
    }
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
        aria-label={`Job detail: ${job.design}`}
        className={cn(
          'relative w-full max-h-[92vh] rounded-2xl flex flex-col overflow-hidden',
          isQuote ? 'max-w-[780px]' : 'max-w-[660px]',
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
        <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #E8EDF5' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-2 mb-1.5"
                style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11.5, fontWeight: 700, color: '#B22234', letterSpacing: '0.04em' }}
              >
                <span>{job.ref}</span>
              </div>
              <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: '#0D1B2A' }}>
                {job.design}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={cn('badge', orderAccent(job.order))}>{job.order}</span>
                <span className={cn('badge', statusAccent(job.status))}>{job.status}</span>
                <span className="badge gray">{job.project}</span>
                <span className={cn('priority-badge', priorityClass(job.priority))}>{job.priority}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ border: '1px solid #E8EDF5', color: '#94A3B8', background: '#fff' }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                  (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
                }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Trigger button — opens the ack popover. While pending: show spinner chip instead. */}
              {canAcknowledge ? (
                acknowledgeJob.isPending ? (
                  /* In-flight: replace button with a muted sending chip so it can't be clicked again */
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 15px',
                      borderRadius: 10,
                      background: 'rgba(178,34,52,0.07)',
                      border: '1.5px solid rgba(178,34,52,0.20)',
                      color: '#B22234',
                      fontSize: 11.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Sending…</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAckPopover(true)}
                    style={{
                      background: 'linear-gradient(135deg,#B22234,#8B1A28)',
                      border: '1.5px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      padding: '7px 15px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      borderRadius: 10,
                      letterSpacing: '0.01em',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 16px rgba(178,34,52,0.40), inset 0 1px 0 rgba(255,255,255,0.14)',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseOver={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = 'linear-gradient(135deg,#991B2A,#7F1521)';
                      btn.style.boxShadow = '0 6px 22px rgba(178,34,52,0.55), inset 0 1px 0 rgba(255,255,255,0.14)';
                      btn.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      btn.style.background = 'linear-gradient(135deg,#B22234,#8B1A28)';
                      btn.style.boxShadow = '0 4px 16px rgba(178,34,52,0.40), inset 0 1px 0 rgba(255,255,255,0.14)';
                      btn.style.transform = 'translateY(0)';
                    }}
                    aria-label="Open acknowledgement panel"
                  >
                    <Timer className="w-3.5 h-3.5" aria-hidden />
                    <span>Send Acknowledgement</span>
                  </button>
                )
              ) : !isDelivered && isAcknowledged && etaCountdown && !etaCountdown.expired ? (
                /* ETA still counting down — chip only, no deliver button yet */
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg,rgba(37,99,235,0.10),rgba(37,99,235,0.05))',
                    border: '1.5px solid rgba(37,99,235,0.22)',
                    borderRadius: 10,
                    padding: '6px 12px',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
                  }}
                >
                  <Timer className="w-3.5 h-3.5 shrink-0" style={{ color: '#2563EB' }} aria-hidden />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 12.5,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        color: '#1D4ED8',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {etaCountdown.display}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: '#60A5FA',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ETA remaining
                    </span>
                  </div>
                </div>
              ) : !isDelivered && isAcknowledged && (!etaCountdown || etaCountdown.expired) ? (
                /* ETA expired (or no ETA set) — replace chip with Deliver Project button */
                <button
                  type="button"
                  onClick={() => setShowSendMailModal(true)}
                  style={{
                    background: 'linear-gradient(135deg,#B22234,#8B1A28)',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    color: '#fff',
                    padding: '7px 15px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 10,
                    letterSpacing: '0.01em',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px rgba(178,34,52,0.40), inset 0 1px 0 rgba(255,255,255,0.14)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseOver={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.background = 'linear-gradient(135deg,#991B2A,#7F1521)';
                    btn.style.boxShadow = '0 6px 22px rgba(178,34,52,0.55), inset 0 1px 0 rgba(255,255,255,0.14)';
                    btn.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.background = 'linear-gradient(135deg,#B22234,#8B1A28)';
                    btn.style.boxShadow = '0 4px 16px rgba(178,34,52,0.40), inset 0 1px 0 rgba(255,255,255,0.14)';
                    btn.style.transform = 'translateY(0)';
                  }}
                  aria-label="Open deliver project panel"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden />
                  <span>Deliver Project</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── ACK POPOVER ── */}
        {showAckPopover && canAcknowledge && (() => {
          // Quote flow only: ETA was already communicated to the client in the
          // price email, so lock it. For regular order flow the admin can always
          // edit the ETA here even if it was pre-set via the Edit modal.
          const etaIsLocked = (isQuote || job?.project === 'Quote') && job != null && job.etaHours != null && job.etaHours > 0;
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
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: '#fff' }}>

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

          {/* Normal detail view — hidden when compare mode is active */}
          {!showCompare && (<>

            {/* TOP LAYOUT — Image carousel (+ pricing card when in quote view) */}
            {(() => {
              const totalImages = images.length;
              const canPaginate = totalImages > 2;
              const atStart = !canPaginate || carPage === 0;
              const atEnd = !canPaginate || carPage >= totalImages - 2;
              const navPrev = () => setCarPage((p) => Math.max(0, p - 1));
              const navNext = () => setCarPage((p) => Math.min(totalImages - 2, p + 1));
              const arrowBase: React.CSSProperties = {
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 30,
                height: 30,
                borderRadius: 999,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                transition: 'background 0.15s',
              };
              return (
                <div
                  className={cn('grid gap-4 mb-5', isQuote ? 'grid-cols-1 md:grid-cols-2' : '')}
                  style={isQuote ? { alignItems: 'stretch' } : undefined}
                >
                  {/* LEFT — image carousel */}
                  <div className="flex flex-col min-w-0">
                    <SectionLabel>JOB IMAGES</SectionLabel>
                    <div className="relative flex-1" style={{ minHeight: 0 }}>
                      {totalImages !== 1 && (
                        <button
                          type="button"
                          onClick={navPrev}
                          disabled={atStart}
                          aria-label="Previous image"
                          style={{
                            ...arrowBase,
                            left: -14,
                            opacity: atStart ? 0.25 : 1,
                            cursor: atStart ? 'default' : 'pointer',
                          }}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div
                        className={totalImages === 1 ? 'flex justify-center items-center' : 'grid grid-cols-2 gap-2.5'}
                        style={{ height: isQuote ? 260 : 240, overflow: 'hidden' }}
                      >
                        {images.map((src, i) => {
                          const visible = totalImages === 1 || (i >= carPage && i < carPage + 2);
                          return (
                            <img
                              key={`${job.uuid}-${src}-${i}`}
                              src={src}
                              alt={i === 0 ? job.design : ''}
                              className={totalImages === 1 ? 'rounded-xl object-contain' : 'w-full rounded-xl object-cover'}
                              style={{
                                display: visible ? 'block' : 'none',
                                height: '100%',
                                minHeight: 0,
                                maxWidth: '100%',
                                border: '1px solid rgba(15,23,42,0.06)',
                                background: 'rgba(0,0,0,0.04)',
                              }}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          );
                        })}
                      </div>
                      {totalImages !== 1 && (
                        <button
                          type="button"
                          onClick={navNext}
                          disabled={atEnd}
                          aria-label="Next image"
                          style={{
                            ...arrowBase,
                            right: -14,
                            opacity: atEnd ? 0.25 : 1,
                            cursor: atEnd ? 'default' : 'pointer',
                          }}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* RIGHT — Review & Set Price card (quote view only) */}
                  {isQuote ? (
                    <div className="flex flex-col min-w-0">
                      <SectionLabel>REVIEW &amp; SET PRICE</SectionLabel>
                      <div
                        className="rounded-xl flex-1 flex flex-col"
                        style={{
                          background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                          border: '1.5px solid #FCD34D',
                          padding: 14,
                          gap: 10,
                          color: '#92400E',
                          boxShadow: '0 8px 30px rgba(217,119,6,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
                        }}
                      >
                        {/* Price + ETA row — equal columns, matching reference */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
                          <div style={{ minWidth: 0 }}>
                            <label
                              className="block uppercase"
                              style={{ color: '#92400E', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 5 }}
                            >
                              Quote Price <span style={{ color: '#B22234' }}>*</span>
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 11,
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: '#D97706',
                                  pointerEvents: 'none',
                                  lineHeight: 1,
                                }}
                              >
                                $
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={MAX_PRICE}
                                step="any"
                                value={agencyPrice}
                                readOnly={quoteSent}
                                disabled={quoteSent}
                                onChange={(e) => {
                                  // Strip non-numeric chars + cap length, then
                                  // flag over-cap values as invalid live so the
                                  // red border + error appear as the rep types,
                                  // not only when they click Send Price.
                                  const next = trimNumeric(e.target.value, MAX_PRICE_LEN);
                                  setAgencyPrice(next);
                                  const n = parseFloat(next);
                                  setPriceInvalid(Number.isFinite(n) && n > MAX_PRICE);
                                }}
                                style={{
                                  width: '100%',
                                  background: quoteSent ? '#FEF3C7' : '#FFFFFF',
                                  border: `1.5px solid ${priceInvalid ? '#DC2626' : '#FCD34D'}`,
                                  color: '#92400E',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  borderRadius: 8,
                                  padding: '7px 12px 7px 26px',
                                  height: 34,
                                  lineHeight: 1,
                                  outline: 'none',
                                  boxShadow: 'inset 0 1px 2px rgba(217,119,6,0.05)',
                                  cursor: quoteSent ? 'not-allowed' : 'text',
                                }}
                              />
                            </div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <label
                              className="block uppercase"
                              style={{ color: '#92400E', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 5 }}
                            >
                              Confirmed ETA (hrs) <span style={{ color: '#B22234' }}>*</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={MAX_ETA_HOURS}
                              step="any"
                              value={confirmedEta}
                              readOnly={quoteSent}
                              disabled={quoteSent}
                              onChange={(e) => {
                                const next = trimNumeric(e.target.value, MAX_ETA_LEN);
                                setConfirmedEta(next);
                                const n = parseFloat(next);
                                setEtaInvalid(Number.isFinite(n) && n > MAX_ETA_HOURS);
                              }}
                              style={{
                                width: '100%',
                                background: quoteSent ? '#FEF3C7' : '#FFFFFF',
                                border: `1.5px solid ${etaInvalid ? '#DC2626' : '#FCD34D'}`,
                                color: '#92400E',
                                fontSize: 13,
                                fontWeight: 600,
                                borderRadius: 8,
                                padding: '7px 12px',
                                height: 34,
                                lineHeight: 1,
                                outline: 'none',
                                boxShadow: 'inset 0 1px 2px rgba(217,119,6,0.05)',
                                cursor: quoteSent ? 'not-allowed' : 'text',
                              }}
                            />
                          </div>
                        </div>

                        {/* Note to Client */}
                        <div>
                          <label
                            className="block uppercase"
                            style={{ color: '#92400E', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 5 }}
                          >
                            Note to Client{' '}
                            <span style={{ fontWeight: 500, textTransform: 'lowercase', fontSize: 9.5, opacity: 0.7 }}>
                              (optional)
                            </span>
                          </label>
                          <textarea
                            value={noteToClient}
                            readOnly={quoteSent}
                            disabled={quoteSent}
                            onChange={(e) => setNoteToClient(e.target.value)}
                            placeholder={quoteSent && !noteToClient ? '— No note sent —' : undefined}
                            style={{
                              width: '100%',
                              background: quoteSent ? '#FEF3C7' : '#FFFFFF',
                              border: '1.5px solid #FCD34D',
                              color: '#92400E',
                              fontSize: 12,
                              fontWeight: 500,
                              borderRadius: 8,
                              padding: '7px 12px',
                              lineHeight: 1.4,
                              minHeight: 44,
                              resize: quoteSent ? 'none' : 'vertical',
                              outline: 'none',
                              boxShadow: 'inset 0 1px 2px rgba(217,119,6,0.05)',
                              cursor: quoteSent ? 'not-allowed' : 'text',
                            }}
                          />
                        </div>

                        {/* Info banner — message swaps when the price has
                          already been dispatched to the client. */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: quoteSent ? 'rgba(5,150,105,0.06)' : 'rgba(217,119,6,0.04)',
                            border: `1px dashed ${quoteSent ? '#10B981' : '#FCD34D'}`,
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 10.5,
                            color: quoteSent ? '#065F46' : '#B45309',
                            lineHeight: 1.45,
                          }}
                        >
                          <AlertCircle className="w-3 h-3 shrink-0" style={{ marginTop: 1 }} aria-hidden />
                          <span>
                            {quoteSent
                              ? <>Price already sent. Status is <b>Quote Approved</b> — awaiting client confirmation.</>
                              : <>Sending price updates status to <b>Quote Approved</b> and requests client confirmation.</>}
                          </span>
                        </div>

                        {/* Validation error — message picks the missing field(s)
                          so the user knows what's actually wrong. */}
                        {priceInvalid || etaInvalid ? (
                          <div
                            style={{
                              color: '#DC2626',
                              fontSize: 11,
                              padding: '6px 10px',
                              background: 'rgba(220,38,38,0.08)',
                              border: '1px solid rgba(220,38,38,0.2)',
                              borderRadius: 6,
                              fontWeight: 600,
                            }}
                          >
                            {(() => {
                              // Per-field reason: distinguish "missing/zero"
                              // from "over the cap" so the rep knows what
                              // specifically failed.
                              const priceMsg = priceInvalid
                                ? (parseFloat(agencyPrice) > MAX_PRICE
                                  ? `Quoted price must be at most $${MAX_PRICE.toLocaleString()}.`
                                  : 'Please enter a valid quoted price.')
                                : null;
                              const etaMsg = etaInvalid
                                ? (parseFloat(confirmedEta) > MAX_ETA_HOURS
                                  ? `Confirmed ETA must be at most ${MAX_ETA_HOURS}h (30 days).`
                                  : 'Please enter a valid confirmed ETA.')
                                : null;
                              return [priceMsg, etaMsg].filter(Boolean).join(' ');
                            })()}
                          </div>
                        ) : null}

                        {/* Action buttons — Reject is still valid while waiting
                          on the client; Send Price is hidden once a price has
                          been sent so the rep can't dispatch a second one. */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 'auto' }}>
                          {/* Cancel button — rejects the quote and closes the price panel 
                        <button
                          type="button"
                          onClick={handleRejectQuote}
                          disabled={isSubmitting}
                          style={{
                            background: 'transparent',
                            border: '1.5px solid #D97706',
                            color: '#92400E',
                            padding: '7px 13px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 99,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.55 : 1,
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          onMouseOver={(e) => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,119,6,0.08)'; }}
                          onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <X className="w-2.5 h-2.5" style={{ marginRight: 4 }} aria-hidden />
                          {rejectQuote.isPending ? 'Cancelling…' : 'Cancel'}
                        </button>*/}
                          {!quoteSent ? (
                            <button
                              type="button"
                              onClick={handleSendPrice}
                              disabled={isSubmitting}
                              style={{
                                background: '#D97706',
                                border: '1.5px solid #D97706',
                                color: '#FFFFFF',
                                padding: '7px 15px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 99,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                opacity: isSubmitting ? 0.55 : 1,
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              onMouseOver={(e) => {
                                if (isSubmitting) return;
                                (e.currentTarget as HTMLButtonElement).style.background = '#B45309';
                                (e.currentTarget as HTMLButtonElement).style.borderColor = '#B45309';
                              }}
                              onMouseOut={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = '#D97706';
                                (e.currentTarget as HTMLButtonElement).style.borderColor = '#D97706';
                              }}
                            >
                              <svg
                                width="11" height="11" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round"
                                style={{ marginRight: 4 }}
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {sendPrice.isPending ? 'Sending…' : 'Send Price'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* WORKFLOW STEPPER */}
            <div className="mb-5 relative">
              {/* Background track */}
              <div
                className="absolute"
                style={{ top: 19, left: 19, right: 19, height: 2, background: '#E8EDF5', zIndex: 0 }}
              />
              {/* Progress fill */}
              <div
                className="absolute"
                style={{
                  top: 19,
                  left: 19,
                  width: stepIdx === 0
                    ? 0
                    : `calc(${Math.min(stepIdx, flowSteps.length - 1)} / ${flowSteps.length - 1} * (100% - 38px))`,
                  height: 2,
                  background: '#B22234',
                  zIndex: 0,
                  transition: 'width 0.4s ease',
                }}
              />

              <div className="flex items-start relative" style={{ zIndex: 1 }}>
                {flowSteps.map((step, i) => {
                  const state = i < stepIdx ? 'done'
                    : i === stepIdx ? 'current'
                      : 'pending';
                  const raw = (job.rawStatus ?? '').toUpperCase();
                  let subLabel = step.sub;
                  if (i === 1) {
                    if (state === 'current') {
                      if (raw === 'JOB_PLACED' || raw === 'CS_APPROVED') {
                        subLabel = 'Pending';
                      } else if (job.assignedTo) {
                        subLabel = job.assignedTo;
                      } else {
                        subLabel = job.etaHours ? `ETA: ${job.etaHours}h` : 'In Progress';
                      }
                    }
                  }
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                        style={
                          state === 'done'
                            ? { background: '#B22234', border: '2px solid #B22234' }
                            : state === 'current'
                              ? { background: curBg, border: `2.5px solid ${curBorder}`, boxShadow: `0 0 0 4px ${curGlow}` }
                              : { background: '#fff', border: '2px solid #E2E8F0' }
                        }
                      >
                        {state === 'done' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : state === 'current' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={curBorder} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                          </svg>
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#CBD5E1' }} />
                        )}
                      </div>
                      <div className="text-center mt-1.5">
                        <div
                          className="text-[11px] font-bold"
                          style={{ color: state === 'pending' ? '#94A3B8' : '#0D1B2A' }}
                        >
                          {step.role}
                        </div>
                        <div className="text-[10px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
                          {subLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TWO-COLUMN DETAILS */}
            <div
              className="grid grid-cols-2 gap-x-6 mb-5 pt-4"
              style={{ borderTop: '1px solid #E8EDF5' }}
            >
              {/* JOB DETAILS */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.13em] mb-2" style={{ color: '#94A3B8' }}>
                  JOB DETAILS
                </div>
                <DetailRow label="Client ID" value={displayJob.clientId} />
                <DetailRow label="Order Type" value={displayJob.order} />
                {displayJob.specificType ? <DetailRow label="Specific Service" value={displayJob.specificType} /> : null}
                <DetailRow label="Complexity" value={displayJob.complexity} />
                {displayJob.process ? <DetailRow label="Process" value={displayJob.process} /> : null}
                <DetailRow label="Colors" value={String(displayJob.colors)} />
                {displayJob.finalFiles?.length ? (
                  <DetailRow
                    label="Output Formats"
                    value={(() => {
                      const text = displayJob.notes || displayJob.summary;
                      const match = text?.match(/\[\s*Expected Output Format\s*:\s*([^\]]*?)\s*\]/i);
                      const customFormat = match && match[1] ? match[1].trim() : null;
                      return displayJob.finalFiles.map(f => {
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
                      }).join(', ');
                    })()}
                  />
                ) : null}
                <DetailRow label="Assigned To" value={displayJob.assignedTo ?? 'Unassigned'} />
                {displayJob.subType ? <DetailRow label="Sub-Type" value={displayJob.subType} /> : null}
              </div>

              {/* SPECIFICATIONS */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.13em] mb-2" style={{ color: '#94A3B8' }}>
                  SPECIFICATIONS
                </div>
                {displayJob.etaHours ? <DetailRow label="ETA" value={`${displayJob.etaHours}h`} /> : null}
                {isAcknowledged && etaCountdown ? (
                  <DetailRow
                    label="ETA Countdown"
                    value={etaCountdown.display}
                    valueStyle={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 11,
                      color: etaCountdown.expired ? '#059669' : '#1D4ED8',
                      fontWeight: 700,
                    }}
                  />
                ) : null}
                <DetailRow label="Created" value={displayJob.created} />
                <DetailRow
                  label="Reference"
                  value={displayJob.ref}
                  valueStyle={{ color: '#B22234', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5 }}
                />
                {displayJob.clientPo ? (
                  <DetailRow
                    label="Client PO / Ref"
                    value={displayJob.clientPo}
                    valueStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5 }}
                  />
                ) : null}
                <DetailRow
                  label="Client Budget"
                  value={clientBudget !== null ? `$${Number(clientBudget).toLocaleString()}` : 'Not provided'}
                />
                <DetailRow
                  label="Admin Counter"
                  value={adminCounter !== null ? `$${Number(adminCounter).toLocaleString()}` : 'None'}
                />
                <DetailRow
                  label="Agreed Price"
                  value={agreedPrice !== null ? `$${Number(agreedPrice).toLocaleString()}` : 'Pending'}
                />
                {displayJob.aiScore && aiOverall !== null ? (
                  <DetailRow
                    label="AI QC Score"
                    value={`${aiOverall}/100 — ${aiPass ? 'Pass' : 'Fail'}`}
                    valueStyle={{ color: aiPass ? '#059669' : '#DC2626', fontWeight: 700 }}
                  />
                ) : null}
              </div>
            </div>

            {/* NOTES / BRIEF */}
            {displayJob.notes ? (
              <div className="mb-5">
                <SectionLabel>NOTES / BRIEF</SectionLabel>
                <div
                  className="text-[12.5px] leading-relaxed p-3.5 rounded-xl"
                  style={{ background: '#F8FAFC', border: '1px solid #E8EDF5', color: '#475569' }}
                >
                  {displayJob.notes}
                </div>
              </div>
            ) : null}

            {/* AI QC REPORT */}
            {displayJob.aiScore ? (
              <div className="mb-2">
                <SectionLabel>AI QC REPORT</SectionLabel>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EDF5' }}>
                  {/* Badge row */}
                  <div
                    className="px-4 pt-3 pb-2.5 flex items-center gap-3"
                    style={{ borderBottom: '1px solid #E8EDF5' }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(178,34,52,0.10)', color: '#B22234', border: '1px solid rgba(178,34,52,0.18)' }}
                    >
                      AI ANALYSIS
                    </span>
                    <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                      Auto-generated · First-pass reference only
                    </span>
                  </div>

                  {/* Score bars */}
                  <div className="grid grid-cols-5 gap-2 px-4 py-3">
                    <ScoreBar label="COLOUR" value={displayJob.aiScore!.colour} color="#ef4444" />
                    <ScoreBar label="ALIGNMENT" value={displayJob.aiScore!.align} color="#3b82f6" />
                    <ScoreBar label="RESOLUTION" value={displayJob.aiScore!.res} color="#a855f7" />
                    <ScoreBar label="BRIEF" value={displayJob.aiScore!.brief} color="#f59e0b" />
                    <ScoreBar label="OVERALL" value={aiOverall ?? 0} color="#B22234" />
                  </div>

                  {/* Recommendation callout */}
                  {aiPass !== null ? (
                    <div
                      className="mx-4 mb-3 px-3.5 py-2.5 rounded-lg flex items-start gap-2"
                      style={{
                        background: aiPass ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
                        border: `1px solid ${aiPass ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
                      }}
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={aiPass ? '#059669' : '#DC2626'}
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, marginTop: 1 }}
                      >
                        {aiPass
                          ? <><circle cx="12" cy="12" r="10" /><polyline points="20 6 9 17 4 12" /></>
                          : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                        }
                      </svg>
                      <span className="text-[11.5px] leading-relaxed" style={{ color: aiPass ? '#059669' : '#DC2626' }}>
                        <strong>AI Recommendation: {aiPass ? 'PASS' : 'FAIL'}</strong>
                        {aiPass
                          ? ' — Design meets quality standards. Minor colour variance within acceptable tolerance.'
                          : ' — Review required. Quality threshold not met.'}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

          </>)}

          {/* ── QUERIES ── always use the canonical (non-admin-copy) job ID so
              the thread is shared with the client viewing the original job. */}
          {!showCompare && (
            <JobQueriesSection jobId={(job.isAdminCopy && job.parentJobId) ? job.parentJobId : (job.uuid ?? null)} />
          )}

        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-6 py-3.5 flex-wrap"
          style={{ borderTop: '1px solid #E8EDF5', background: '#FAFBFD' }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
            onClick={handleDownloadAllFiles}
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            Download Files
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '7px 13px', gap: 6, marginLeft: 'auto' }}
            onClick={handleClose}
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Close
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              fontSize: 12,
              padding: '7px 13px',
              gap: 6,
            }}
            onClick={() => onEdit?.(job)}
            disabled={isDelivered}
          >
            <Edit2 className="w-3.5 h-3.5" aria-hidden />
            Edit Job
          </button>
          {!isQuote && isAcknowledged && !isDelivered ? (
            <button
              type="button"
              className="btn btn-crimson"
              style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
              onClick={() => setShowSendMailModal(true)}
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              Deliver Project
            </button>
          ) : null}
          {!isQuote && isCsApproved ? (
            <button
              type="button"
              className="btn btn-crimson"
              style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
              onClick={() => setShowMarkComplete(true)}
            >
              <PackageCheck className="w-3.5 h-3.5" aria-hidden />
              Mark Complete
            </button>
          ) : null}
          {!isQuote && isReadyToDeliver ? (
            <button
              type="button"
              className="btn btn-crimson"
              style={{ fontSize: 12, padding: '7px 13px', gap: 6 }}
              onClick={() => setShowDispatchConfirm(true)}
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              Dispatch to Client
            </button>
          ) : null}
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
                const priceStr = Number(parseFloat(agencyPrice) || 0).toLocaleString();
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
                  <strong>Quote Approved</strong>. The client will be prompted to authorize the final price and ETA to commence production.
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
                  onChange={(e) => setConfirmText(e.target.value)}
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
                  Deliver Project
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
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Files to be sent ({allCompletedFiles.length + sendMailFiles.length})
                </div>

                {allCompletedFiles.length === 0 && sendMailFiles.length === 0 ? (
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
                    {/* Already Uploaded Files */}
                    {allCompletedFiles.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Completed Deliverables on Server ({allCompletedFiles.length})
                        </div>
                        {allCompletedFiles.map((f) => (
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
                            <span style={{ fontSize: 10.5, color: '#64748B' }}>
                              Ready
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

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
                  onChange={(e) => setSendMailConfirmText(e.target.value)}
                  disabled={sendMailPhase !== 'idle'}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      sendMailConfirmText.trim().toUpperCase() === 'CONFIRM' &&
                      sendMailPhase === 'idle' &&
                      (allCompletedFiles.length + sendMailFiles.length) > 0
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
                const totalFilesCount = allCompletedFiles.length + sendMailFiles.length;
                const ready = sendMailConfirmText.trim().toUpperCase() === 'CONFIRM' && totalFilesCount > 0;
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
                    {sendMailPhase === 'uploading' ? 'Uploading…' : sendMailPhase === 'sending' ? 'Delivering…' : 'Deliver Project'}
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
                  The client will be notified and the job will move to Delivered.
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
                    Job moves to Delivered
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

    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-[9px] font-bold uppercase mb-1.5"
        style={{ color: '#6B7585', letterSpacing: '0.05em' }}
      >
        {label}
      </div>
      {/* Proportional fill over a grey track — matches reference */}
      <div className="overflow-hidden mb-1" style={{ height: 4, background: '#E4E8F0', borderRadius: 2 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 500, color: '#0D1B2A' }}>
        {value}
      </div>
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
        return j.finalFiles.map(f => {
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
        }).join(', ');
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
