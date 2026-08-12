import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { IClient } from '@contracts';
import { useRejectClient } from '../hooks/use-admin-clients';

interface RejectClientModalProps {
  client: IClient | null;
  onClose: () => void;
}

export function RejectClientModal({ client, onClose }: RejectClientModalProps) {
  const [note, setNote] = useState('');
  const reject = useRejectClient();

  useEffect(() => {
    if (!client) return undefined;
    setNote('');

    const mainEl = document.getElementById('main-content');

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) mainEl.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (mainEl) mainEl.style.overflow = '';
    };
  }, [client]);

  if (!client) return null;

  const isValid = note.trim().length >= 10;

  function handleSubmit() {
    if (!isValid || reject.isPending) return;
    
    reject.mutate(
      { id: client!.id, note: note.trim() },
      {
        onSuccess: () => onClose(),
      }
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Reject Client"
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Reject Client Registration</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {client.client_name} ({client.email})
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
            disabled={reject.isPending}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-600">
            You are rejecting the registration for <strong className="text-slate-900">{client.client_name}</strong> ({client.email}).
          </p>

          <div>
            <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
              Reason for rejection
            </label>
            <p className="text-[11.5px] text-slate-500 mb-2">
              This note will be emailed directly to the client. Please provide a clear explanation.
            </p>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. We are unable to verify your business details..."
              style={note.length > 0 && !isValid ? { borderColor: '#f87171' } : undefined}
            />
            {note.length > 0 && !isValid && (
              <p className="text-[11px] mt-1 text-rose-500 font-medium">
                Please provide a reason (at least 10 characters).
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
            onClick={onClose}
            disabled={reject.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!isValid || reject.isPending}
          >
            <X className="w-4 h-4 text-rose-600" />
            <span>{reject.isPending ? 'Rejecting…' : 'Reject Client'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
