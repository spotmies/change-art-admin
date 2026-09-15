import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@modules/auth/services';
import { useAuthStore } from '@modules/auth/stores/auth-store';
import { ApiClientError } from '@lib/api-client';
import { ERROR_CODES, ERROR_MESSAGES, UserRole, type SessionUser } from '@contracts';
import { pathForRole } from '@/router';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@lib/utils';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof LoginSchema>;

const OtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

type OtpValues = z.infer<typeof OtpSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const isDeactivated = !!(location.state as { deactivated?: boolean } | null)?.deactivated;
  const [serverError, setServerError] = useState<string | null>(
    isDeactivated ? 'Your account has been deactivated. Contact an administrator.' : null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; email: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    reset: resetOtpForm,
    formState: { errors: otpErrors, isSubmitting: isOtpSubmitting },
  } = useForm<OtpValues>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { code: '' },
  });

  function completeSignIn(user: SessionUser) {
    if (user.role === UserRole.CLIENT) {
      void authService.signOut();
      setServerError('Access denied. This platform is for internal staff only.');
      setChallenge(null);
      return;
    }
    // Clear stale cache from any previous session before setting the new user.
    queryClient.clear();
    setUser(user);
    const home = pathForRole(user.role);
    const from = (location.state as { from?: string } | null)?.from;
    // Only honour `from` if it lives under this user's home section.
    // Otherwise a previous session (e.g. CS) would send a freshly-signed-in
    // admin to /cs instead of /admin.
    const destination = from?.startsWith(home) ? from : home;
    navigate(destination, { replace: true });
    toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
  }

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      const result = await authService.signIn(values);
      if (result.status === 'otp_required') {
        setChallenge({ id: result.challengeId, email: values.email });
        resetOtpForm();
        return;
      }
      completeSignIn(result.user);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === ERROR_CODES.INVALID_CREDENTIALS) {
          setServerError(ERROR_MESSAGES.INVALID_CREDENTIALS);
        } else if (err.code === ERROR_CODES.ACCOUNT_DEACTIVATED) {
          setServerError(ERROR_MESSAGES.ACCOUNT_DEACTIVATED);
        } else {
          setServerError(err.toUserMessage());
        }
      } else {
        setServerError(ERROR_MESSAGES.UNKNOWN_ERROR);
      }
    }
  }

  async function onSubmitOtp(values: OtpValues) {
    if (!challenge) return;
    setServerError(null);
    try {
      const user = await authService.verifyLoginOtp(challenge.id, values.code);
      completeSignIn(user);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === ERROR_CODES.OTP_EXPIRED || err.code === ERROR_CODES.TOO_MANY_OTP_ATTEMPTS) {
          // The challenge is dead either way — send them back to re-enter
          // credentials and get a fresh code.
          setServerError(err.toUserMessage());
          setChallenge(null);
        } else if (err.code === ERROR_CODES.INVALID_OTP) {
          setServerError(ERROR_MESSAGES.INVALID_OTP);
        } else {
          setServerError(err.toUserMessage());
        }
      } else {
        setServerError(ERROR_MESSAGES.UNKNOWN_ERROR);
      }
    }
  }

  if (challenge) {
    return (
      <form onSubmit={handleOtpSubmit(onSubmitOtp)} noValidate aria-label="Verify sign-in code">
        <h2 className="text-[18px] font-bold mb-1 flex justify-center">Check your email</h2>
        <p className="text-[12.5px] text-text-muted mb-6 text-center">
          We sent a 6-digit code to <span className="text-text-base">{challenge.email}</span>.
          Enter it below to finish signing in.
        </p>

        <label className="block">
          <span className="lbl">Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className={cn('inp text-center tracking-[0.3em] font-mono', otpErrors.code && 'aria-invalid')}
            aria-invalid={otpErrors.code ? 'true' : 'false'}
            aria-describedby={otpErrors.code ? 'otp-code-error' : undefined}
            {...registerOtp('code')}
          />
          {otpErrors.code ? (
            <p id="otp-code-error" className="text-[11px] text-status-red mt-1" role="alert">
              {otpErrors.code.message}
            </p>
          ) : null}
        </label>

        <div className="mt-2 mb-5" />

        {serverError ? (
          <div
            role="alert"
            className="text-[12px] mb-3 p-2.5 rounded-lg border border-status-red/30 bg-status-red/10 text-[#fca5a5]"
          >
            {serverError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isOtpSubmitting}
          aria-busy={isOtpSubmitting}
          className="btn btn-crimson w-full"
        >
          {isOtpSubmitting ? 'Verifying…' : 'Verify and sign in'}
        </button>

        <button
          type="button"
          className="text-[11.5px] text-text-muted hover:text-text-base transition-colors mt-4 w-full text-center"
          onClick={() => {
            setChallenge(null);
            setServerError(null);
          }}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Sign in">
      <h2 className="text-[18px] font-bold mb-1 flex justify-center">Sign in</h2>

      <label className="block">
        <span className="lbl">Email</span>
        <input
          type="email"
          autoComplete="email"
          className={cn('inp', errors.email && 'aria-invalid')}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p id="login-email-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </label>

      <label className="block mt-3">
        <span className="lbl">Password</span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="inp pr-10"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'login-pw-error' : undefined}
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        </div>
        {errors.password ? (
          <p id="login-pw-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </label>

      <div className="mt-2 mb-5" />

      {serverError ? (
        <div
          role="alert"
          className="text-[12px] mb-3 p-2.5 rounded-lg border border-status-red/30 bg-status-red/10 text-[#fca5a5]"
        >
          {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="btn btn-crimson w-full"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

    </form>
  );
}
