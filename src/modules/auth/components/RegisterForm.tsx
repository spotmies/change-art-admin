import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@modules/auth/services';
import { useAuthStore } from '@modules/auth/stores/auth-store';
import { ApiClientError } from '@lib/api-client';
import { ERROR_CODES, ERROR_MESSAGES } from '@contracts';
import { pathForRole } from '@/router';

const RegisterSchema = z
  .object({
    name: z.string().min(2, 'Please enter your full name'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please re-type your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof RegisterSchema>;

/**
 * Self-service signup is open to clients only. Internal staff accounts
 * (CS, TL, Designer, etc.) are provisioned by Admin via the user-management
 * panel — the backend's `auth.config` `databaseHooks.user.create.after`
 * assigns `role: CLIENT` for these signups.
 */
export function RegisterForm() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    try {
      const user = await authService.signUp({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      setUser(user);
      navigate(pathForRole(user.role), { replace: true });
      toast.success(`Welcome, ${user.name.split(' ')[0]}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === ERROR_CODES.EMAIL_ALREADY_EXISTS) {
          setServerError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
        } else {
          setServerError(err.toUserMessage());
        }
      } else {
        setServerError(ERROR_MESSAGES.UNKNOWN_ERROR);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Create an account">
      <h2 className="text-[18px] font-bold mb-1">Create your client account</h2>


      <label className="block">
        <span className="lbl">Full Name</span>
        <input
          type="text"
          autoComplete="name"
          className="inp"
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'reg-name-error' : undefined}
          {...register('name')}
        />
        {errors.name ? (
          <p id="reg-name-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.name.message}
          </p>
        ) : null}
      </label>

      <label className="block mt-3">
        <span className="lbl">Email</span>
        <input
          type="email"
          autoComplete="email"
          className="inp"
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'reg-email-error' : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p id="reg-email-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </label>

      <label className="block mt-3">
        <span className="lbl">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          className="inp"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'reg-pw-error' : undefined}
          {...register('password')}
        />
        {errors.password ? (
          <p id="reg-pw-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </label>

      <label className="block mt-3 mb-5">
        <span className="lbl">Confirm Password</span>
        <input
          type="password"
          autoComplete="new-password"
          className="inp"
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          aria-describedby={errors.confirmPassword ? 'reg-pw2-error' : undefined}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p id="reg-pw2-error" className="text-[11px] text-status-red mt-1" role="alert">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </label>

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
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-[11.5px] text-text-muted mt-6 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-crimson hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
