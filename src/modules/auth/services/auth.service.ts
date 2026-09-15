import { apiClient, ApiClientError } from '@lib/api-client';
import { ERROR_CODES, type SessionUser } from '@contracts';

/**
 * Auth service — thin wrapper around Better Auth's HTTP routes. The session
 * cookie is HTTP-only and managed by the server. This service NEVER reads
 * or writes a cookie directly.
 *
 * Routes follow Better Auth's Express adapter mount point (`/api/auth/*`).
 */

export interface SignInPayload {
  email: string;
  password: string;
}

/**
 * Result of the password step. Staff sign-in is always two-factor: a correct
 * password never returns a session directly — it returns a challenge id that
 * `verifyLoginOtp` must be called with, using the code emailed to the user.
 */
export type SignInResult =
  | { status: 'otp_required'; challengeId: string }
  | { status: 'signed_in'; user: SessionUser };

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
}

/** Better Auth's sign-in / sign-up response shape. */
interface BetterAuthResponse {
  user?: BetterAuthUser;
  // error body (Better Auth returns { code, message } on failure)
  code?: string;
  message?: string;
}

/** Response shape for the password step once OTP-gated (see auth.routes.ts). */
interface SignInOtpChallengeResponse {
  otpRequired: true;
  challengeId: string;
}

interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  sub_type?: string | null;
  tenant_id?: string;
  is_active?: boolean;
}

function adaptUser(raw: BetterAuthUser | null | undefined): SessionUser | null {
  if (!raw) return null;
  if (!raw.role || !raw.tenant_id || raw.is_active === undefined) {
    // Server returned a partial session — treat as unauthenticated rather
    // than guessing fields and risking a role mismatch.
    return null;
  }
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role as SessionUser['role'],
    sub_type: (raw.sub_type as SessionUser['sub_type']) ?? null,
    tenant_id: raw.tenant_id,
    is_active: raw.is_active,
  };
}

export const authService = {
  /** Fetch the current session. Returns null when the cookie is missing or invalid. */
  async fetchSession(): Promise<SessionUser | null> {
    try {
      const data = await apiClient.get<{ user: SessionUser } | null>('/api/v1/auth/session');
      return data?.user ?? null;
    } catch (err) {
      if (err instanceof ApiClientError && err.code === ERROR_CODES.NETWORK_ERROR) {
        throw err;
      }
      return null;
    }
  },

  /**
   * Step 1: verify email + password. Staff sign-in never returns a session
   * here — a correct password gets an emailed OTP and a challenge id; call
   * `verifyLoginOtp` with it to actually receive the session.
   */
  async signIn(payload: SignInPayload): Promise<SignInResult> {
    try {
      const res = await apiClient.raw.post<BetterAuthResponse | SignInOtpChallengeResponse>(
        '/api/auth/sign-in/email',
        payload,
      );
      if ('otpRequired' in res.data && res.data.otpRequired) {
        return { status: 'otp_required', challengeId: res.data.challengeId };
      }
      const user = adaptUser((res.data as BetterAuthResponse).user ?? null);
      if (!user) {
        throw new ApiClientError({
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Sign-in succeeded but no session user was returned.',
          status: 500,
        });
      }
      if (!user.is_active) {
        await authService.signOut().catch(() => {});
        throw new ApiClientError({
          code: ERROR_CODES.ACCOUNT_DEACTIVATED,
          message: 'Your account has been deactivated. Contact an administrator.',
          status: 403,
        });
      }
      return { status: 'signed_in', user };
    } catch (err) {
      // Our own typed errors (thrown above, or already normalised by the api-client
      // interceptor from Better Auth's { code, message } error body) — remap Better
      // Auth's raw codes onto our ERROR_CODES so LoginForm's branches match, and
      // re-throw everything else unchanged.
      if (err instanceof ApiClientError) {
        if (err.code === 'INVALID_EMAIL_OR_PASSWORD') {
          throw new ApiClientError({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Email or password is incorrect.', status: err.status });
        }
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          throw new ApiClientError({ code: ERROR_CODES.UNAUTHENTICATED, message: err.message || 'Sign-in failed. Please try again.', status: err.status });
        }
        throw err;
      }
      throw new ApiClientError({ code: ERROR_CODES.INTERNAL_ERROR, message: 'Sign-in failed. Please try again.', status: 500 });
    }
  },

  /**
   * Step 2: submit the emailed 6-digit code for a pending challenge. Only on
   * success does the server attach the session cookie.
   */
  async verifyLoginOtp(challengeId: string, code: string): Promise<SessionUser> {
    const res = await apiClient.raw.post<BetterAuthResponse>('/api/auth/verify-login-otp', {
      challengeId,
      code,
    });
    const user = adaptUser(res.data.user ?? null);
    if (!user) {
      throw new ApiClientError({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Sign-in succeeded but no session user was returned.',
        status: 500,
      });
    }
    if (!user.is_active) {
      await authService.signOut().catch(() => {});
      throw new ApiClientError({
        code: ERROR_CODES.ACCOUNT_DEACTIVATED,
        message: 'Your account has been deactivated. Contact an administrator.',
        status: 403,
      });
    }
    return user;
  },

  async signUp(payload: SignUpPayload): Promise<SessionUser> {
    const res = await apiClient.raw.post<BetterAuthResponse>(
      '/api/auth/sign-up/email',
      payload,
    );
    const user = adaptUser(res.data.user ?? null);
    if (!user) {
      throw new ApiClientError({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Sign-up succeeded but no session user was returned.',
        status: 500,
      });
    }
    return user;
  },

  async signOut(): Promise<void> {
    await apiClient.raw.post<void>('/api/auth/sign-out', undefined, {
      validateStatus: () => true,
    });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.raw.post<void>('/api/auth/request-password-reset', {
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.raw.post<void>('/api/auth/reset-password', { token, newPassword });
  },

  signInWithGoogleUrl(): string {
    return '/api/auth/sign-in/social?provider=google';
  },
};
