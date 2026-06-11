import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@modules/auth/services';
import { useAuthStore } from '@modules/auth/stores/auth-store';
import { ApiClientError } from '@lib/api-client';
import { ERROR_CODES, ERROR_MESSAGES, UserRole } from '@contracts';
import { pathForRole } from '@/router';
import { cn } from '@lib/utils';

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const isDeactivated = !!(location.state as { deactivated?: boolean } | null)?.deactivated;
  const [serverError, setServerError] = useState<string | null>(
    isDeactivated ? 'Your account has been deactivated. Contact an administrator.' : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    try {
      const user = await authService.signIn(values);
      if (user.role === UserRole.CLIENT) {
        await authService.signOut();
        setServerError('Access denied. This platform is for internal staff only.');
        return;
      }
      setUser(user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? pathForRole(user.role), { replace: true });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Sign in">
      <h2 className="text-[18px] font-bold mb-1">Sign in</h2>
      <p className="text-[12.5px] text-text-muted mb-6">
        Continue to your role-specific dashboard.
      </p>

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
        <input
          type="password"
          autoComplete="current-password"
          className="inp"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'login-pw-error' : undefined}
          {...register('password')}
        />
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
