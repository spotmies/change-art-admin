/**
 * useAssignJob — hook test.
 *
 * Mocks the assignments API client directly (not the underlying fetch
 * layer) so this stays a fast, deterministic unit test of the hook's own
 * logic: it calls assignmentsApi.create with the given body, invalidates
 * the jobs query cache on success, and surfaces a toast on both success and
 * failure (including the optimistic-lock-conflict path, surfaced by the
 * backend as a 409 JOB_CARD_VERSION_MISMATCH ApiClientError).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';

vi.mock('../services/assignments.service', () => ({
  assignmentsApi: { create: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { assignmentsApi } from '../services/assignments.service';
import { useAssignJob } from './use-assignments';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAssignJob', () => {
  it('calls assignmentsApi.create with the given body and shows a success toast', async () => {
    vi.mocked(assignmentsApi.create).mockResolvedValue({ id: 'job-1' } as any);
    const { result } = renderHook(() => useAssignJob(), { wrapper });

    result.current.mutate({ job_card_id: 'job-1', assigned_to: 'designer-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignmentsApi.create).toHaveBeenCalledWith({ job_card_id: 'job-1', assigned_to: 'designer-1' });
    expect(toast.success).toHaveBeenCalledWith('Job assigned.');
  });

  it('surfaces a toast error and does not throw when the API call rejects', async () => {
    vi.mocked(assignmentsApi.create).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useAssignJob(), { wrapper });

    result.current.mutate({ job_card_id: 'job-1', assigned_to: 'designer-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });

  it('surfaces the optimistic-lock-conflict error the same way as any other failure', async () => {
    const conflict = Object.assign(new Error('Job Card has been modified.'), { code: 'JOB_CARD_VERSION_MISMATCH' });
    vi.mocked(assignmentsApi.create).mockRejectedValue(conflict);
    const { result } = renderHook(() => useAssignJob(), { wrapper });

    result.current.mutate({ job_card_id: 'job-1', assigned_to: 'designer-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(conflict);
    expect(toast.error).toHaveBeenCalled();
  });
});
