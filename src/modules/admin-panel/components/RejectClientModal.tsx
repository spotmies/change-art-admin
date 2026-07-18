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
    if (client) {
      setNote('');
    }
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
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label="Reject Client"
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title text-status-red">Reject Client Registration</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        <div className="modal-body">
          <p className="text-[13px] text-text-primary mb-4">
            You are rejecting the account registration for <span className="font-semibold">{client.client_name}</span> ({client.email}).
          </p>
          
          <div className="m-sec-title">Reason for rejection</div>
          <p className="text-[12px] text-text-faint mb-3">
            This note will be emailed directly to the client. Please provide a clear explanation.
          </p>

          <textarea
            className="fi"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. We are unable to verify your business details..."
            style={note.length > 0 && !isValid ? { borderColor: 'var(--color-crimson)' } : undefined}
          />
          {note.length > 0 && !isValid && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-crimson)' }}>
              Please provide a reason (at least 10 characters).
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={reject.isPending}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-crimson" 
            onClick={handleSubmit} 
            disabled={!isValid || reject.isPending}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject Client'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
