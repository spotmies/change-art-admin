import { useEffect, useMemo } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';

/** A not-yet-uploaded local file, previewed via an in-memory blob URL. */
export interface LocalPreviewSource {
  kind: 'local';
  file: File;
}

/** An already-uploaded server file, previewed via a (usually presigned) URL. */
export interface RemotePreviewSource {
  kind: 'remote';
  url: string;
  name: string;
  type?: string;
}

export type PreviewSource = LocalPreviewSource | RemotePreviewSource;

interface FilePreviewModalProps {
  source: PreviewSource | null;
  /** Remote previews are opened before the URL resolves — show a spinner. */
  loading?: boolean;
  onClose: () => void;
}

/** Lightbox for a file — images render inline, PDFs render in an iframe,
 * anything else falls back to a download prompt. Works for both a local
 * pre-upload `File` (blob URL) and an already-uploaded server file (any URL). */
export function FilePreviewModal({ source, loading, onClose }: FilePreviewModalProps) {
  const localFile = source?.kind === 'local' ? source.file : null;
  const objectUrl = useMemo(() => (localFile ? URL.createObjectURL(localFile) : null), [localFile]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!source && !loading) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, loading, onClose]);

  if (!source && !loading) return null;

  const name = source?.kind === 'local' ? source.file.name : source?.name ?? '';
  const type = source?.kind === 'local' ? source.file.type : source?.type ?? '';
  const url = source?.kind === 'local' ? objectUrl : source?.url ?? null;

  const isImage = type.startsWith('image/');
  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 anim-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        className="glass-heavy rounded-2xl w-full max-w-[720px] max-h-[85vh] p-5 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="file-preview-title" className="text-[14px] font-bold truncate pr-2">
            {name || 'Loading preview…'}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {url ? (
              <a
                href={url}
                download={name}
                target={source?.kind === 'remote' ? '_blank' : undefined}
                rel={source?.kind === 'remote' ? 'noopener noreferrer' : undefined}
                className="btn btn-outline !p-1.5"
                aria-label={`Download ${name}`}
              >
                <Download aria-hidden className="w-3.5 h-3.5" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline !p-1.5"
              aria-label="Close preview"
            >
              <X aria-hidden className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          {!url ? (
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} aria-hidden />
          ) : isImage ? (
            <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={name} className="w-full h-[70vh] border-0" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <span
                className="w-14 h-14 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                aria-hidden
              >
                <FileText className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
              </span>
              <p className="text-[12.5px] text-text-muted">
                Preview isn&apos;t available for this file type.
              </p>
              <a href={url} download={name} className="btn btn-crimson !text-[12px]">
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
