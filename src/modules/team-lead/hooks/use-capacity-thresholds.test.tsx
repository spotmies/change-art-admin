/**
 * useCapacityThresholds / useUpdateCapacityThresholds — hook tests.
 *
 * Verifies the read hook returns the service's current thresholds, and the
 * update mutation writes the mutated result straight into the query cache
 * (so the Settings panel reflects the save immediately without waiting for
 * a refetch) plus invalidates the broader staff-directory cache (so
 * Free/Busy/Overloaded badges recompute against the new thresholds).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';

vi.mock('../services/staff-directory.service', () => ({
  staffDirectoryService: {
    list: vi.fn(),
    getCapacityThresholds: vi.fn(),
    setCapacityThresholds: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { staffDirectoryService } from '../services/staff-directory.service';
import { useCapacityThresholds, useUpdateCapacityThresholds } from './use-capacity-thresholds';

const DEFAULTS = { DESIGNER_JUNIOR: 2, DESIGNER_SENIOR: 3, DIGITATOR_JUNIOR: 2, DIGITATOR_SENIOR: 3, SEWOUT: 3 };

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCapacityThresholds', () => {
  it('returns the thresholds from the service', async () => {
    vi.mocked(staffDirectoryService.getCapacityThresholds).mockResolvedValue(DEFAULTS as any);
    const qc = makeClient();

    const { result } = renderHook(() => useCapacityThresholds(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DEFAULTS);
  });
});

describe('useUpdateCapacityThresholds', () => {
  it('writes the mutated thresholds straight into the cache and invalidates staff-directory queries', async () => {
    const updated = { ...DEFAULTS, SEWOUT: 5 };
    vi.mocked(staffDirectoryService.setCapacityThresholds).mockResolvedValue(updated as any);
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateCapacityThresholds(), { wrapper: makeWrapper(qc) });

    result.current.mutate(updated);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staffDirectoryService.setCapacityThresholds).toHaveBeenCalledWith(updated);
    expect(qc.getQueryData(['staff-directory', 'capacity-thresholds'])).toEqual(updated);
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['staff-directory'] }));
    expect(toast.success).toHaveBeenCalledWith('Capacity thresholds updated.');
  });

  it('surfaces a toast error on failure without throwing', async () => {
    vi.mocked(staffDirectoryService.setCapacityThresholds).mockRejectedValue(new Error('boom'));
    const qc = makeClient();

    const { result } = renderHook(() => useUpdateCapacityThresholds(), { wrapper: makeWrapper(qc) });

    result.current.mutate(DEFAULTS as any);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
