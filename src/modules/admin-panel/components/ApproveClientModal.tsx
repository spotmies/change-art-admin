import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import type { IClient } from '@contracts';
import { useApproveClient, useCheckClientId } from '../hooks/use-admin-clients';

interface ApproveClientModalProps {
  client: IClient | null;
  onClose: () => void;
}

export function ApproveClientModal({ client, onClose }: ApproveClientModalProps) {
  const [clientId, setClientId] = useState('');
  
  // Update state when modal opens with a new client and lock background scroll
  useEffect(() => {
    if (!client) return undefined;
    setClientId(client.client_id);

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

  const approve = useApproveClient();
  
  // Check uniqueness only if it's 5 digits and different from the client's current auto-generated one
  const { data: checkData, isLoading: isChecking } = useCheckClientId(clientId, client?.id);

  const isValidFormat = /^\d{5}$/.test(clientId);
  const isAvailable = checkData?.available ?? true;
  
  const canApprove = isValidFormat && isAvailable && !isChecking && !approve.isPending;

  if (!client) return null;

  function handleSubmit() {
    if (!canApprove) return;

    // Always send the confirmed/assigned 5-digit Client ID so the backend updates DB and emails the client with it
    const finalClientId = clientId || client?.client_id;

    approve.mutate(
      { id: client!.id, clientId: finalClientId },
      {
        onSuccess: () => onClose(),
      },
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Approve Client"
    >
      <div
        className="bg-white rounded-[8px] border border-slate-200/90 shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Approve Client Registration</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {client.client_name} {client.company_name ? `(${client.company_name})` : ''}
            </p>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            onClick={onClose}
            aria-label="Close"
            disabled={approve.isPending}
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Name</span>
              <span className="font-bold text-slate-900">{client.client_name}</span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Company</span>
              <span className="font-bold text-slate-900">{client.company_name || '—'}</span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Email</span>
              <span className="font-bold text-slate-900">{client.email}</span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 font-semibold mb-0.5">Phone</span>
              <span className="font-bold text-slate-900 font-mono">{client.contact_number}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
              Assign Client ID
            </label>
            <p className="text-[11.5px] text-slate-500 mb-2">
              An auto-generated 5-digit ID has been assigned. You can modify it before approval.
            </p>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                value={clientId}
                onChange={(e) => setClientId(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="e.g. 84291"
                maxLength={5}
                style={!isValidFormat || (!isAvailable && clientId.length === 5) ? { borderColor: '#f87171' } : undefined}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : isValidFormat && isAvailable ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : clientId.length === 5 && !isAvailable ? (
                  <X className="w-4 h-4 text-rose-500" />
                ) : null}
              </div>
            </div>

            {clientId.length > 0 && !isValidFormat && (
              <p className="text-[11px] mt-1 text-rose-500 font-medium">
                Client ID must be exactly 5 digits.
              </p>
            )}
            {clientId.length === 5 && !isAvailable && !isChecking && (
              <p className="text-[11px] mt-1 text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                This Client ID is already in use.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
            onClick={onClose}
            disabled={approve.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-[6px] bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!canApprove}
          >
            <Check className="w-4 h-4" />
            <span>{approve.isPending ? 'Approving…' : 'Approve Client'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
