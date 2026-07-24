import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCompletedFile } from '../services/cs-quote.service';
import { useMarkComplete, useNotifyOrderReady } from '../hooks/use-cs-quote';
import { toastApiError } from '@lib/toast-error';

interface Props {
  jobId: string;
  jobDesign: string;
  orderType: string;
  allowedFormats?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = 'idle' | 'uploading' | 'completing' | 'sending';

export function MarkCompleteModal({ jobId, jobDesign, orderType, allowedFormats, onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [stitchCount, setStitchCount] = useState('');
  const [note, setNote] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markComplete = useMarkComplete();
  const notifyReady = useNotifyOrderReady();

  const showStitchCount = orderType === 'Digitizing' || orderType === 'Digitizing + Sewout';
  const isPending = phase !== 'idle';

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const incomingFiles = Array.from(incoming);
    if (allowedFormats && allowedFormats.length > 0) {
      const invalid = incomingFiles.filter((f) => {
        const dotIdx = f.name.lastIndexOf('.');
        const ext = dotIdx !== -1 ? f.name.slice(dotIdx + 1).toLowerCase() : '';
        return !allowedFormats.includes(ext);
      });
      if (invalid.length > 0) {
        toast.error(`Only ${allowedFormats.map((e) => e.toUpperCase()).join(', ')} formats allowed for this job.`);
        return;
      }
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...incomingFiles.filter((f) => !existing.has(f.name + f.size))];
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (files.length === 0) {
      toast.error('Upload at least one completed file before submitting.');
      return;
    }
    const parsedStitch = stitchCount ? parseInt(stitchCount, 10) : undefined;
    if (showStitchCount && stitchCount && (isNaN(parsedStitch!) || parsedStitch! <= 0)) {
      toast.error('Stitch count must be a positive whole number.');
      return;
    }

    // Step 1 — upload files, collect IDs
    setPhase('uploading');
    const uploadedIds: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const id = await uploadCompletedFile(jobId, files[i]);
        uploadedIds.push(id);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } catch (err) {
      setPhase('idle');
      toastApiError(err);
      return;
    }

    // Step 2 — mark complete (READY_TO_DELIVER)
    setPhase('completing');
    await new Promise<void>((resolve, reject) => {
      markComplete.mutate(
        { jobId, body: { stitch_count: parsedStitch, note: note.trim() || undefined } },
        {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        },
      );
    }).catch((err) => {
      setPhase('idle');
      toastApiError(err);
      return Promise.reject(err);
    });

    // Step 3 — notify client & move to DELIVERED
    setPhase('sending');
    notifyReady.mutate(
      { jobId, fileIds: uploadedIds, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setPhase('idle');
          onSuccess();
        },
        onError: (err) => {
          setPhase('idle');
          toastApiError(err);
        },
      },
    );
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const phaseLabel =
    phase === 'uploading' ? `Uploading… ${uploadProgress}%` :
    phase === 'completing' ? 'Marking complete…' :
    phase === 'sending' ? 'Sending to client…' :
    null;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mark complete and send to client"
        className="relative w-full max-w-[500px] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.01em' }}>
              Mark Complete &amp; Send to Client
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              {jobDesign}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', padding: 4 }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Bypass warning — this is a production-pipeline shortcut, not the
              default path, now that Team Lead/Designer/Digitator/Sewout/QC
              panels are real (ChangeArt-New-PRD.md §1.6, §4 item 5). */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.25)',
              fontSize: 11.5,
              color: '#92400E',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 700, flexShrink: 0 }}>Bypass:</span>
            <span>
              This skips Team Lead assignment, producer execution, and QC review entirely — the job
              goes straight to delivery unlocked and unreviewed. Use only when the real pipeline
              isn't appropriate for this job.
            </span>
          </div>

          {/* File upload */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
              Completed Files <span style={{ color: '#B22234' }}>*</span>
            </div>
            {allowedFormats && allowedFormats.length > 0 && (
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Client requested format:{' '}
                <span style={{ color: '#059669', fontWeight: 700 }}>
                  {allowedFormats.map((f) => f.toUpperCase()).join(', ')}
                </span>
              </div>
            )}
            <label
              htmlFor="mc-file-input"
              onDragOver={(e) => { e.preventDefault(); if (!isPending) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!isPending) addFiles(e.dataTransfer.files); }}
              style={{
                display: 'block',
                border: `2px dashed ${isDragging ? '#059669' : '#CBD5E1'}`,
                borderRadius: 10,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: isPending ? 'not-allowed' : 'pointer',
                background: isDragging ? 'rgba(5,150,105,0.04)' : '#F8FAFC',
                transition: 'all 0.15s',
              }}
            >
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: isDragging ? '#059669' : '#94A3B8' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                Drop files here or <span style={{ color: '#059669', textDecoration: 'underline' }}>browse</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                {allowedFormats && allowedFormats.length > 0
                  ? `${allowedFormats.map((f) => f.toUpperCase()).join(', ')} — up to 500 MB each`
                  : 'Any format — up to 500 MB each'}
              </div>
            </label>
            <input
              id="mc-file-input"
              ref={fileInputRef}
              type="file"
              multiple
              accept={(() => {
                if (!allowedFormats || allowedFormats.length === 0) return undefined;
                const browserKnown = ['pdf', 'ai', 'eps', 'cdr', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'tiff', 'tif', 'psd', 'zip'];
                const knownOnly = allowedFormats.filter((f) => browserKnown.includes(f));
                return knownOnly.length > 0 ? knownOnly.map((ext) => `.${ext}`).join(',') : undefined;
              })()}
              className="hidden"
              disabled={isPending}
              onChange={(e) => addFiles(e.target.files)}
            />
            {files.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-[11.5px]"
                    style={{ background: '#F1F5F9', borderRadius: 6, padding: '5px 10px' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#059669' }} />
                    <span className="truncate flex-1" style={{ color: '#334155' }}>{f.name}</span>
                    <span style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {!isPending && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stitch count — Digitizing only */}
          {showStitchCount && (
            <div>
              <label
                htmlFor="mc-stitch"
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}
              >
                Stitch Count (optional)
              </label>
              <input
                id="mc-stitch"
                type="text"
                inputMode="numeric"
                value={stitchCount}
                onChange={(e) => setStitchCount(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 12500"
                disabled={isPending}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{
                  width: '100%',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 600,
                  color: '#0F172A',
                  background: isPending ? '#F8FAFC' : '#fff',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#059669'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label
              htmlFor="mc-note"
              style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}
            >
              Note to Client (optional)
            </label>
            <textarea
              id="mc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              rows={2}
              maxLength={500}
              placeholder="Any delivery notes for the client…"
              style={{
                width: '100%',
                border: '1.5px solid #E2E8F0',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                color: '#0F172A',
                background: isPending ? '#F8FAFC' : '#fff',
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.15s',
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#059669'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
            />
          </div>

          {/* Confirm field */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '16px 20px',
              borderRadius: 12,
              background: confirmText.trim().toUpperCase() === 'CONFIRM'
                ? 'rgba(5,150,105,0.06)'
                : '#F8FAFC',
              border: `1.5px solid ${confirmText.trim().toUpperCase() === 'CONFIRM' ? 'rgba(5,150,105,0.35)' : '#E2E8F0'}`,
              transition: 'all 0.2s',
            }}
          >
            <label
              htmlFor="mc-confirm"
              style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center' }}
            >
              Type{' '}
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', background: '#E8F5F0', padding: '2px 7px', borderRadius: 5, color: '#059669', letterSpacing: '0.06em' }}>
                CONFIRM
              </span>{' '}
              to send files to client
            </label>
            <input
              id="mc-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="CONFIRM"
              disabled={isPending}
              autoComplete="off"
              style={{
                width: 160,
                border: `2px solid ${confirmText.trim().toUpperCase() === 'CONFIRM' ? '#059669' : '#CBD5E1'}`,
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 14,
                fontFamily: 'IBM Plex Mono, monospace',
                fontWeight: 700,
                color: confirmText.trim().toUpperCase() === 'CONFIRM' ? '#059669' : '#0F172A',
                background: '#fff',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.1em',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            />
            {confirmText.trim().toUpperCase() === 'CONFIRM' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                Ready to send
              </div>
            )}
          </div>

          {/* Progress bar while working */}
          {isPending && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                <span>{phaseLabel}</span>
                {phase === 'uploading' && <span>{uploadProgress}%</span>}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: phase === 'uploading' ? `${uploadProgress}%` : '100%',
                    background: 'linear-gradient(90deg,#059669,#047857)',
                    borderRadius: 2,
                    transition: phase === 'uploading' ? 'width 0.2s' : 'none',
                    animation: phase !== 'uploading' ? 'pulse 1.2s ease-in-out infinite' : 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-6 py-3.5"
          style={{ borderTop: '1px solid #E8EDF5', background: '#FAFBFD' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 9,
              border: '1.5px solid #E2E8F0',
              background: '#fff',
              color: '#64748B',
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || files.length === 0 || confirmText.trim().toUpperCase() !== 'CONFIRM'}
            style={{
              flex: 2,
              padding: '9px 0',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 9,
              border: 'none',
              background: isPending || files.length === 0 || confirmText.trim().toUpperCase() !== 'CONFIRM'
                ? 'linear-gradient(135deg,#9CA3AF,#6B7280)'
                : 'linear-gradient(135deg,#059669,#047857)',
              color: '#fff',
              cursor: isPending || files.length === 0 || confirmText.trim().toUpperCase() !== 'CONFIRM' ? 'not-allowed' : 'pointer',
              opacity: isPending || files.length === 0 || confirmText.trim().toUpperCase() !== 'CONFIRM' ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: isPending || files.length === 0 || confirmText.trim().toUpperCase() !== 'CONFIRM' ? 'none' : '0 3px 12px rgba(5,150,105,0.35)',
              transition: 'all 0.15s',
            }}
          >
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> {phaseLabel}</>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Mark Complete &amp; Send to Client</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
