import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '@modules/auth/services';

const ResetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetValues = z.infer<typeof ResetSchema>;

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') ?? '';
  const TOKEN_RE = /^[A-Za-z0-9_\-.~]{16,256}$/;
  const token = TOKEN_RE.test(rawToken) ? rawToken : '';
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(ResetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div aria-live="polite">
        <h2 className="text-[18px] font-bold mb-1">Invalid reset link</h2>
        <p className="text-[12.5px] text-text-muted mb-6">
          This password reset link is invalid or missing. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn btn-crimson w-full justify-center">
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div aria-live="polite">
        <h2 className="text-[18px] font-bold mb-1">Password updated</h2>
        <p className="text-[12.5px] text-text-muted mb-6">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <button
          type="button"
          className="btn btn-crimson w-full"
          onClick={() => navigate('/login')}
        >
          Sign in
        </button>
      </div>
    );
  }

  async function onSubmit(values: ResetValues) {
    setServerError(null);
    try {
      await authService.resetPassword(token, values.newPassword);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      const isExpired =
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('token');
      setServerError(
        isExpired
          ? 'This reset link has expired or is invalid. Please request a new one.'
          : 'Something went wrong. Please try again or request a new reset link.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Set new password">
      <h2 className="text-[18px] font-bold mb-1">Set a new password</h2>
      <p className="text-[12.5px] text-text-muted mb-6">
        Choose a strong password — at least 8 characters.
      </p>

      <label className="block mb-4">
        <span className="lbl">New password</span>
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            className="inp pr-10"
            aria-invalid={errors.newPassword ? 'true' : 'false'}
            aria-describedby={errors.newPassword ? 'rp-pw-error' : undefined}
            {...register('newPassword')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
            onClick={() => setShowNew((v) => !v)}
            tabIndex={-1}
            aria-label={showNew ? 'Hide password' : 'Show password'}
          >
            {showNew ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        </div>
        {errors.newPassword ? (
          <p id="rp-pw-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.newPassword.message}
          </p>
        ) : null}
      </label>

      <label className="block mb-5">
        <span className="lbl">Confirm password</span>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            className="inp pr-10"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby={errors.confirmPassword ? 'rp-confirm-error' : undefined}
            {...register('confirmPassword')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
            onClick={() => setShowConfirm((v) => !v)}
            tabIndex={-1}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        </div>
        {errors.confirmPassword ? (
          <p id="rp-confirm-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </label>

      {serverError ? (
        <div
          role="alert"
          className="text-[12px] mb-3 p-2.5 rounded-lg border border-status-red/30 bg-status-red/10 text-[#fca5a5]"
        >
          {serverError}{' '}
          <Link to="/forgot-password" className="underline">
            Request a new link
          </Link>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="btn btn-crimson w-full"
      >
        {isSubmitting ? 'Saving…' : 'Save new password'}
      </button>

      <p className="text-[11.5px] text-text-muted mt-6 text-center">
        Remembered it?{' '}
        <Link to="/login" className="text-crimson hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
