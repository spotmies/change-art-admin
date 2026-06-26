import { useRef, useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCompletedFile } from '../services/cs-quote.service';
import { useMarkComplete } from '../hooks/use-cs-quote';
import { toastApiError } from '@lib/toast-error';

interface Props {
  jobId: string;
  jobDesign: string;
  /** e.g. 'Digitizing' or 'Digitizing + Sewout' — controls stitch count field visibility */
  orderType: string;
  allowedFormats?: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkCompleteModal({ jobId, jobDesign, orderType, allowedFormats, onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [stitchCount, setStitchCount] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markComplete = useMarkComplete();

  const showStitchCount = orderType === 'Digitizing' || orderType === 'Digitizing + Sewout';
  const isPending = phase !== 'idle';

  function addFiles(incoming: FileList | null) {
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
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const next = incomingFiles.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...next];
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (files.length === 0) {
      toast.error('Upload at least one completed file before marking complete.');
      return;
    }
    const parsedStitch = stitchCount ? parseInt(stitchCount, 10) : undefined;
    if (showStitchCount && stitchCount && (isNaN(parsedStitch!) || parsedStitch! <= 0)) {
      toast.error('Stitch count must be a positive whole number.');
      return;
    }

    setPhase('uploading');
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadCompletedFile(jobId, files[i]);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
    } catch (err) {
      setPhase('idle');
      toastApiError(err);
      return;
    }

    setPhase('saving');
    markComplete.mutate(
      {
        jobId,
        body: {
          stitch_count: parsedStitch,
          note: note.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setPhase('idle');
          onSuccess();
        },
        onError: () => {
          setPhase('idle');
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mark complete and ready to deliver"
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
              Mark Complete &amp; Ready to Deliver
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

          {/* File upload */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
              Completed Files <span style={{ color: '#B22234' }}>*</span>
            </div>
            {allowedFormats && allowedFormats.length > 0 && (
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Expected Format: <span style={{ color: '#059669', fontWeight: 700 }}>{allowedFormats.map(f => f.toUpperCase()).join(', ')}</span>
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => !isPending && fileInputRef.current?.click()}
              style={{
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
                  ? allowedFormats.map(f => f.toUpperCase()).join(', ')
                  : 'PDF, PNG, JPG, AI, EPS, CDR'} — up to 500 MB each
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedFormats && allowedFormats.length > 0
                ? allowedFormats.map(ext => `.${ext}`).join(',')
                : ".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps,.cdr,image/*"}
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

          {/* Stitch count — Digitizing orders only */}
          {showStitchCount && (
            <div>
              <label
                style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}
              >
                Stitch Count (optional)
              </label>
              <input
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
              style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}
            >
              Note (optional)
            </label>
            <textarea
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

          {/* Upload progress */}
          {phase === 'uploading' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                <span>Uploading files…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg,#059669,#047857)',
                    borderRadius: 2,
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          )}

          {/* Info callout */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11.5px]"
            style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.18)', color: '#047857' }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Files must pass the virus scan before they can be delivered. The job will appear on
              the <strong>Ready to Deliver</strong> page once complete.
            </span>
          </div>
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
            disabled={isPending || files.length === 0}
            style={{
              flex: 2,
              padding: '9px 0',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 9,
              border: 'none',
              background: isPending || files.length === 0
                ? 'linear-gradient(135deg,#9CA3AF,#6B7280)'
                : 'linear-gradient(135deg,#059669,#047857)',
              color: '#fff',
              cursor: isPending || files.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPending || files.length === 0 ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              boxShadow: isPending || files.length === 0 ? 'none' : '0 3px 12px rgba(5,150,105,0.35)',
              transition: 'all 0.15s',
            }}
          >
            {phase === 'uploading' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Uploading…</>
            ) : phase === 'saving' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Saving…</>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Mark Complete &amp; Ready to Deliver</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
