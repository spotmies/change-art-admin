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
  
  // Update state when modal opens with a new client
  useEffect(() => {
    if (client) {
      setClientId(client.client_id);
    }
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
    
    // Only send the override if it's different from the original auto-generated ID
    const overrideId = clientId !== client?.client_id ? clientId : undefined;
    
    approve.mutate(
      { id: client!.id, clientId: overrideId },
      {
        onSuccess: () => onClose(),
      }
    );
  }

  const modal = (
    <div
      className="modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal
      aria-label="Approve Client"
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title">Approve Client Registration</div>
            <div className="modal-tags">
              <span className="badge blue">Pending</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        <div className="modal-body">
          <div className="m-sec-title">Client Information</div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mb-6 text-[13px]">
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Name</div>
              <div>{client.client_name}</div>
            </div>
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Company</div>
              <div>{client.company_name || '—'}</div>
            </div>
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Email</div>
              <div>{client.email}</div>
            </div>
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Phone</div>
              <div>{client.contact_number}</div>
            </div>
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Country</div>
              <div>{client.country || '—'}</div>
            </div>
            <div>
              <div className="text-text-faint text-[11px] uppercase tracking-wider mb-1">Currency</div>
              <div>{client.currency || 'USD'}</div>
            </div>
          </div>

          <div className="m-sec-title">Assign Client ID</div>
          <p className="text-[12px] text-text-faint mb-3">
            An auto-generated 5-digit ID has been assigned. You can modify it before approval if needed.
          </p>

          <div>
            <label className="fl">Client ID</label>
            <div className="relative">
              <input
                className="fi pr-8 font-mono"
                value={clientId}
                onChange={(e) => setClientId(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="e.g. 84291"
                maxLength={5}
                style={!isValidFormat || (!isAvailable && clientId.length === 5) ? { borderColor: 'var(--crimson)' } : undefined}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking ? (
                  <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                ) : isValidFormat && isAvailable ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : clientId.length === 5 && !isAvailable ? (
                  <X className="w-4 h-4 text-status-red" />
                ) : null}
              </div>
            </div>
            
            {clientId.length > 0 && !isValidFormat && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--crimson)' }}>
                Client ID must be exactly 5 digits.
              </p>
            )}
            {clientId.length === 5 && !isAvailable && !isChecking && (
              <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--crimson)' }}>
                <AlertCircle className="w-3 h-3" />
                This Client ID is already in use.
              </p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={approve.isPending}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-crimson" 
            onClick={handleSubmit} 
            disabled={!canApprove}
          >
            {approve.isPending ? 'Approving…' : 'Approve Client'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
