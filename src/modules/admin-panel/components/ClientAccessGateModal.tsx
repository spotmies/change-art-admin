import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, X, ShieldAlert, KeyRound } from 'lucide-react';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { ApiClientError } from '@lib/api-client';
import { ERROR_CODES } from '@contracts';
import type { IClient } from '@contracts';
import type { ClientModalMode } from './ClientDetailModal';

interface ClientAccessGateModalProps {
  client: IClient | null;
  mode: ClientModalMode;
  /** Called when the user successfully verifies. Opens the real detail modal. */
  onVerified: (client: IClient, mode: ClientModalMode) => void;
  onClose: () => void;
}

type Step = 'request' | 'verify';

export function ClientAccessGateModal({
  client,
  mode,
  onVerified,
  onClose,
}: ClientAccessGateModalProps) {
  const user = useSessionUser();
  const [step, setStep] = useState<Step>('request');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // Reset state whenever the modal opens for a new client.
  useEffect(() => {
    if (client) {
      setStep('request');
      setOtp('');
      setError(null);
      setPending(false);
    }
  }, [client]);

  // Focus the OTP input when we reach the verify step.
  useEffect(() => {
    if (step === 'verify') {
      const t = setTimeout(() => otpRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  useEffect(() => {
    if (!client) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [client, onClose]);

  if (!client || !user) return null;

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { adminService } = await import('../services/admin.service');
      await adminService.requestAccessOtp();
      setStep('verify');
    } catch {
      setError('Failed to send OTP. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || !client) return;
    setError(null);
    setPending(true);
    try {
      const { adminService } = await import('../services/admin.service');
      await adminService.verifyAccessOtp(otp.trim());

      // Notify admin (fire-and-forget)
      void adminService.logClientAccess(client.id).catch(() => undefined);

      onVerified(client, mode);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === ERROR_CODES.INVALID_OTP) {
          setError('Incorrect code. Please try again.');
        } else if (err.code === ERROR_CODES.OTP_EXPIRED) {
          setError('Code expired. Click "Resend" to get a new one.');
          setStep('request');
        } else if (err.code === ERROR_CODES.TOO_MANY_OTP_ATTEMPTS) {
          setError('Too many incorrect attempts. Please request a new code.');
          setStep('request');
        } else {
          setError('Verification failed. Please try again.');
        }
      } else {
        setError('Network error. Check your connection and try again.');
      }
    } finally {
      setPending(false);
    }
  }

  const maskedEmail = user.email.replace(/(.{2}).+(@.+)/, '$1•••$2');

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 anim-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-modal-title"
        className="glass-heavy rounded-2xl w-full max-w-[400px] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 btn btn-outline !p-1.5"
          aria-label="Close"
        >
          <X aria-hidden className="w-3.5 h-3.5" />
        </button>

        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-5">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-full mb-3"
            style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)' }}
          >
            <ShieldAlert className="w-5 h-5" style={{ color: 'var(--crimson)' }} aria-hidden />
          </div>
          <h2 id="gate-modal-title" className="text-[15px] font-bold">
            Verify Identity to Continue
          </h2>
          <p className="text-[12.5px] text-text-muted mt-1 leading-relaxed">
            Client records are business-critical. Verify your identity to{' '}
            <strong>{mode === 'edit' ? 'edit' : 'view'}</strong> details for{' '}
            <span style={{ color: 'var(--text)' }}>
              {client.company_name ?? client.client_name}
            </span>{' '}
            ({client.client_id}).
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
            This access will be logged and reported to the administrator.
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequestOtp} className="space-y-3.5">
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-md text-[12px]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
            >
              <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-faint" aria-hidden />
              <span className="text-text-muted leading-relaxed">
                A one-time code will be sent to <strong style={{ color: 'var(--text)' }}>{maskedEmail}</strong>.
                Enter it on the next screen to unlock access.
              </span>
            </div>

            {error ? (
              <div
                className="text-[12px] px-3 py-2 rounded-md"
                style={{
                  color: '#fca5a5',
                  background: 'rgba(220,38,38,0.12)',
                  border: '1px solid rgba(220,38,38,0.3)',
                }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={onClose}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-crimson flex-1"
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-md text-[12px]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}
            >
              <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-faint" aria-hidden />
              <span className="text-text-muted leading-relaxed">
                A 6-digit code was sent to <strong style={{ color: 'var(--text)' }}>{maskedEmail}</strong>.
                It expires in 10 minutes.
              </span>
            </div>

            <div>
              <label className="fl" htmlFor="gate-otp">
                Verification code
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint pointer-events-none"
                  aria-hidden
                />
                <input
                  ref={otpRef}
                  id="gate-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  className="fi font-mono tracking-[0.3em] text-center"
                  style={{ paddingLeft: 30 }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  disabled={pending}
                  placeholder="••••••"
                />
              </div>
            </div>

            {error ? (
              <div
                className="text-[12px] px-3 py-2 rounded-md"
                style={{
                  color: '#fca5a5',
                  background: 'rgba(220,38,38,0.12)',
                  border: '1px solid rgba(220,38,38,0.3)',
                }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => { setStep('request'); setOtp(''); setError(null); }}
                disabled={pending}
              >
                Resend
              </button>
              <button
                type="submit"
                className="btn btn-crimson flex-1"
                disabled={otp.length !== 6 || pending}
                aria-busy={pending}
              >
                {pending ? 'Verifying…' : 'Verify & Open'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
