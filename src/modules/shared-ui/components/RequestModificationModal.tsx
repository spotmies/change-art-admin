import { useEffect } from 'react';
import { X, Info, Send, Upload } from 'lucide-react';
import { type Job } from '../mocks/jobs';

interface RequestModificationModalProps {
  job: Job | null;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export function RequestModificationModal({ job, onClose, onSubmit }: RequestModificationModalProps) {
  useEffect(() => {
    if (!job) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [job]);

  useEffect(() => {
    if (!job) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [job, onClose]);

  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 anim-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request Modification"
        className="relative w-full sm:max-w-3xl bg-white max-h-[96dvh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{
          animation: 'loginAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--glass-border)] bg-white flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-text-main leading-tight">Request Modification</h2>
            <div className="text-[13px] text-text-muted mt-0.5">
              {job.design} · {job.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-full border border-[rgba(15,23,42,0.14)] hover:border-crimson hover:text-crimson text-text-faint transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-6 bg-white flex flex-col gap-6 overflow-y-auto flex-1">
          {/* Info Alert */}
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: '#f0f5ff', border: '1px solid #dbeafe', color: 'var(--color-blue-dark)' }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden style={{ color: 'var(--color-blue)' }} />
            <div className="text-[12.5px] leading-relaxed">
              Your Client Servicing team will receive this request, reopen the job, and route it back through the production workflow. A new delivery will be made once revisions pass QC.
            </div>
          </div>

          {/* Original Job Info */}
          <div className="flex items-center justify-between text-[12px] pb-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center justify-between gap-2 w-[40%]">
              <span className="text-text-faint">Original Job</span>
              <span className="font-bold text-color-navy-ink">{job.id}</span>
            </div>
            <div className="flex items-center justify-between gap-2 w-[40%]">
              <span className="text-text-faint">Reference No.</span>
              <span className="font-bold text-color-navy-ink">{job.ref || 'N/A'}</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint mb-4">
              What needs to change?
            </div>

            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-2">
                Description of changes required <span style={{ color: 'var(--color-crimson)' }}>*</span>
              </label>
              <textarea
                className="w-full p-3 rounded-xl border border-[var(--glass-border)] text-[13px] text-text-main outline-none focus:border-color-crimson transition min-h-[100px] resize-y"
                placeholder="Describe exactly what needs to be modified — color changes, alignment fixes, size adjustments, etc."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted mb-2">
                Attach new reference files (Optional)
              </label>
              <div
                className="border border-dashed border-[var(--glass-border)] rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition"
                style={{ background: 'rgba(0,0,0,0.01)' }}
              >
                <Upload className="w-5 h-5 text-text-faint mb-2" aria-hidden />
                <div className="text-[13px] font-semibold text-text-muted mb-1">
                  Drop files or <span style={{ color: 'var(--color-navy-ink)' }}>browse</span>
                </div>
                <div className="text-[11px] text-text-faint">
                  PDF, AI, PSD, PNG — max 500 MB
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--glass-border)] hover:border- bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-outline !rounded-full"
            style={{ padding: '9px 24px', fontSize: 13 }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-crimson !rounded-full"
            style={{ padding: '9px 24px', fontSize: 13 }}
            onClick={() => {
              onSubmit?.({});
              onClose();
            }}
          >
            <Send className="w-4 h-4" aria-hidden />
            Submit Modification Request
          </button>
        </div>
      </div>
    </div>
  );
}
