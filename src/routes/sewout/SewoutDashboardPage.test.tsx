/**
 * SewoutDashboardPage — component test (PRD §2.7, §5.7).
 *
 * Verifies: Accept fires sewout_accept with the job's current version;
 * submitting to QC without a stitch count is blocked in the UI (the "Submit
 * to QC" confirm button stays disabled — the backend also enforces
 * stitch_count > 0, see workflow.service.test.ts); and a valid stitch count
 * calls adminService.transitionJobWithStitchCount with the typed count.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Job } from '@modules/shared-ui';

vi.mock('@modules/auth/stores/auth-store', () => ({
  useSessionUser: vi.fn().mockReturnValue({ id: 'sewout-1', name: 'Sam Sewout' }),
}));

vi.mock('@modules/admin-panel/hooks/use-admin-jobs', () => ({
  useAdminJobViews: vi.fn(),
  useAdminJobById: vi.fn().mockReturnValue({ data: undefined }),
}));

vi.mock('@modules/admin-panel/services/admin.service', () => ({
  adminService: { transitionJob: vi.fn(), transitionJobWithStitchCount: vi.fn() },
}));

vi.mock('@modules/cs-panel/services/cs-quote.service', () => ({
  uploadCompletedFile: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { SewoutDashboardPage } from './SewoutDashboardPage';

const PENDING_JOB: Job = {
  id: 'JC-0002',
  uuid: 'job-uuid-2',
  version: 2,
  rawStatus: 'SUBMITTED_TO_SEWOUT',
  ref: 'R-0002',
  client: 'Acme Co',
  clientId: 'client-1',
  design: 'Cap Embroidery',
  summary: 'Front-of-cap embroidery',
  order: 'Digitizing',
  project: 'Live',
  complexity: 'Medium',
  process: null,
  priority: 'Normal',
  etaHours: 24,
  status: 'In Production',
  stage: 'sewout',
  assignedTo: 'Sam Sewout',
  subType: null,
  notes: '',
  colors: 3,
  created: new Date().toISOString(),
  aiScore: null,
};

const IN_PROGRESS_JOB: Job = { ...PENDING_JOB, id: 'JC-0003', uuid: 'job-uuid-3', version: 5, rawStatus: 'SEWOUT_IN_PROGRESS' };

function firstButton(name: RegExp) {
  return screen.getAllByRole('button', { name })[0]!;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SewoutDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SewoutDashboardPage — Accept', () => {
  it('fires sewout_accept with the job current version for a SUBMITTED_TO_SEWOUT job', async () => {
    vi.mocked(useAdminJobViews).mockReturnValue({
      jobs: [PENDING_JOB],
      total: 1,
      isLoading: false,
      isError: false,
      error: null,
    });
    vi.mocked(adminService.transitionJob).mockResolvedValue({} as any);

    renderPage();
    const user = userEvent.setup();
    await user.click(firstButton(/accept/i));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-2', 'sewout_accept', 2),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/sewout in progress/i));
  });
});

describe('SewoutDashboardPage — Submit to QC (stitch count enforcement)', () => {
  it('disables the confirm button until a stitch count > 0 is entered', async () => {
    vi.mocked(useAdminJobViews).mockReturnValue({
      jobs: [IN_PROGRESS_JOB],
      total: 1,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();
    const user = userEvent.setup();
    await user.click(firstButton(/to qc/i));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: /submit to qc/i });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByPlaceholderText(/e\.g\. 14200/i), '0');
    expect(confirmButton).toBeDisabled(); // zero is still invalid — backend requires > 0

    await user.clear(within(dialog).getByPlaceholderText(/e\.g\. 14200/i));
    await user.type(within(dialog).getByPlaceholderText(/e\.g\. 14200/i), '1250');
    expect(confirmButton).not.toBeDisabled();

    expect(adminService.transitionJobWithStitchCount).not.toHaveBeenCalled();
  });

  it('submits with the typed stitch count via transitionJobWithStitchCount', async () => {
    vi.mocked(useAdminJobViews).mockReturnValue({
      jobs: [IN_PROGRESS_JOB],
      total: 1,
      isLoading: false,
      isError: false,
      error: null,
    });
    vi.mocked(adminService.transitionJobWithStitchCount).mockResolvedValue({} as any);

    renderPage();
    const user = userEvent.setup();
    await user.click(firstButton(/to qc/i));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByPlaceholderText(/e\.g\. 14200/i), '14200');
    await user.click(within(dialog).getByRole('button', { name: /submit to qc/i }));

    await waitFor(() =>
      expect(adminService.transitionJobWithStitchCount).toHaveBeenCalledWith(
        'job-uuid-3',
        'sewout_submit',
        5,
        14200,
      ),
    );
  });
});
