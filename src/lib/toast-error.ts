import toast from 'react-hot-toast';
import { ApiClientError } from './api-client';
import { ERROR_MESSAGES, type ErrorCode } from '@contracts';

/** Thrown by mutation guards for user-facing validation failures. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Surface an API error as a toast with the standard human-readable copy.
 *
 * Specific 409 / SESSION_EXPIRED responses get tailored copy because the
 * generic "Something went wrong" misses the recovery action the user needs
 * (refresh + retry, sign in again).
 */
export function toastApiError(err: unknown, fallbackCode: ErrorCode = 'UNKNOWN_ERROR'): void {
  if (err instanceof ApiClientError) {
    toast.error(err.toUserMessage(), {
      id: `api-${err.code}-${err.status}`,
    });
    return;
  }
  if (err instanceof ValidationError) {
    toast.error(err.message);
    return;
  }
  toast.error(ERROR_MESSAGES[fallbackCode] ?? ERROR_MESSAGES.UNKNOWN_ERROR);
}
