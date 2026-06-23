import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  type ApiErrorResponse,
  type ApiResponse,
  type ErrorCode,
  type PaginatedList,
  type PaginationMeta,
} from '@contracts';
import { config } from './config';

/**
 * Thin wrapper around axios that:
 *   • sends/receives session cookies (Better Auth, HTTP-only on the server)
 *   • unwraps the standard SSOT envelope into `data` on success
 *   • converts any error into a typed `ApiClientError` carrying the backend
 *     `code` so callers can switch on `ErrorCode.JOB_CARD_LOCKED` etc.
 *
 * Components MUST go through this client — never call `axios` directly.
 * The `api-contract-guard` subagent audits this rule.
 */

class ApiClientError extends Error {
  public readonly code: ErrorCode | string;
  public readonly status: number;
  public readonly details: Record<string, string[]> | undefined;

  public constructor(opts: {
    code: ErrorCode | string;
    message: string;
    status: number;
    details?: Record<string, string[]>;
  }) {
    super(opts.message);
    this.name = 'ApiClientError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }

  /** Returns the human-readable copy registered in @contracts/error-codes. */
  public toUserMessage(): string {
    if (this.code === 'VALIDATION_ERROR' && this.details) {
      const messages = Object.values(this.details).flat().filter(Boolean);
      if (messages.length > 0) {
        return messages.join(', ');
      }
    }
    return ERROR_MESSAGES[this.code as ErrorCode] ?? this.message ?? ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  public is(code: ErrorCode): boolean {
    return this.code === code;
  }
}

export { ApiClientError };

const axiosInstance: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

function normaliseError(err: unknown): ApiClientError {
  if (err instanceof ApiClientError) return err;

  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorResponse>;

    if (!ax.response) {
      return new ApiClientError({
        code: ERROR_CODES.NETWORK_ERROR,
        message: ERROR_MESSAGES.NETWORK_ERROR,
        status: 0,
      });
    }

    const status = ax.response.status;
    const body = ax.response.data;

    if (body && typeof body === 'object' && body.success === false && body.error) {
      return new ApiClientError({
        code: body.error.code,
        message: body.error.message,
        status,
        details: body.error.details,
      });
    }

    return new ApiClientError({
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: ax.message || ERROR_MESSAGES.UNKNOWN_ERROR,
      status,
    });
  }

  if (err instanceof Error) {
    return new ApiClientError({
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: err.message,
      status: 0,
    });
  }

  return new ApiClientError({
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: ERROR_MESSAGES.UNKNOWN_ERROR,
    status: 0,
  });
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normaliseError(error)),
);

interface RequestOptions extends Omit<AxiosRequestConfig, 'method' | 'url' | 'data' | 'params'> {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T>; status?: number }>): Promise<T> {
  const res = await promise;
  // 204 No Content (e.g. DELETE) is a valid success that carries no envelope —
  // axios leaves `data` as an empty string. Return undefined for these.
  if (res.status === 204 || res.data == null || (res.data as unknown) === '') {
    return undefined as T;
  }
  if (res.data.success !== true) {
    throw new ApiClientError({
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: 'API returned a non-envelope response',
      status: 0,
    });
  }
  return res.data.data;
}

async function unwrapPaginated<T>(
  promise: Promise<{ data: ApiResponse<T[]> }>,
): Promise<PaginatedList<T>> {
  const res = await promise;
  if (!res.data || res.data.success !== true) {
    throw new ApiClientError({
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: 'API returned a non-envelope response',
      status: 0,
    });
  }
  const meta: PaginationMeta = res.data.meta ?? {
    page: 1,
    per_page: res.data.data.length,
    total: res.data.data.length,
    total_pages: 1,
  };
  return { items: res.data.data, meta };
}

export const apiClient = {
  get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return unwrap<T>(axiosInstance.get(url, options));
  },

  getPaginated<T>(url: string, options: RequestOptions = {}): Promise<PaginatedList<T>> {
    return unwrapPaginated<T>(axiosInstance.get(url, options));
  },

  post<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
    return unwrap<T>(axiosInstance.post(url, body, options));
  },

  patch<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
    return unwrap<T>(axiosInstance.patch(url, body, options));
  },

  put<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
    return unwrap<T>(axiosInstance.put(url, body, options));
  },

  delete<T = void>(url: string, options: RequestOptions = {}): Promise<T> {
    return unwrap<T>(axiosInstance.delete(url, options));
  },

  /** Raw axios instance for legacy or non-envelope endpoints (e.g. Better Auth handler). */
  raw: axiosInstance,
};

/** True iff the given error is an `ApiClientError` with the given code. */
export function isApiError(err: unknown, code: ErrorCode): boolean {
  return err instanceof ApiClientError && err.code === code;
}
