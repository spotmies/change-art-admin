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
import { ERROR_CODES, ERROR_MESSAGES, UserRole } from '@contracts';
import { pathForRole } from '@/router';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const isDeactivated = !!(location.state as { deactivated?: boolean } | null)?.deactivated;
  const [serverError, setServerError] = useState<string | null>(
    isDeactivated ? 'Your account has been deactivated. Contact an administrator.' : null,
  );
  const [showPassword, setShowPassword] = useState(false);

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
