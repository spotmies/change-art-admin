/**
 * useStaffDirectory — hook test.
 *
 * Verifies it calls staffDirectoryService.list with the given role filter
 * (or none), returns the resolved entries, and re-queries when the role
 * argument changes (a fresh queryKey per role — see the underlying hook).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../services/staff-directory.service', () => ({
  staffDirectoryService: { list: vi.fn() },
}));

import { staffDirectoryService } from '../services/staff-directory.service';
import { useStaffDirectory } from './use-staff-directory';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useStaffDirectory', () => {
  it('fetches with no role filter by default and returns the resolved entries', async () => {
    const entries = [{ user: { id: 'u1' }, availability: 'FREE' }];
    vi.mocked(staffDirectoryService.list).mockResolvedValue(entries as any);

    const { result } = renderHook(() => useStaffDirectory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staffDirectoryService.list).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(entries);
  });

  it('passes the role filter through to the service', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([] as any);

    const { result } = renderHook(() => useStaffDirectory('SEWOUT'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staffDirectoryService.list).toHaveBeenCalledWith('SEWOUT');
  });

  it('re-fetches when the role argument changes (distinct query key per role)', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([] as any);
    const wrapper = makeWrapper();

    const { result, rerender } = renderHook(
      ({ role }: { role: 'DESIGNER' | 'DIGITATOR' | 'SEWOUT' }) => useStaffDirectory(role),
      { wrapper, initialProps: { role: 'DESIGNER' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staffDirectoryService.list).toHaveBeenCalledTimes(1);

    rerender({ role: 'DIGITATOR' as const });
    await waitFor(() => expect(staffDirectoryService.list).toHaveBeenCalledTimes(2));
    expect(staffDirectoryService.list).toHaveBeenLastCalledWith('DIGITATOR');
  });
});
