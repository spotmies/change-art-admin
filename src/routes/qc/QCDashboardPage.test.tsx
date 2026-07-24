/**
 * QCDashboardPage — component test (PRD §2.8, §5.8).
 *
 * Renders the real page against a mocked job list (via useAdminJobViews) and
 * mocked adminService — verifies: Approve calls qc_open (job not yet opened)
 * then qc_approve with the version returned by qc_open (not the stale one
 * from props); Reject requires feedback and calls qcReject with the chosen
 * reason; and an optimistic-lock conflict (adminService rejects with a 409)
 * surfaces a toast instead of crashing the page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Job } from '@modules/shared-ui';

vi.mock('@modules/admin-panel/hooks/use-admin-jobs', () => ({
  useAdminJobViews: vi.fn(),
  // JobTable (rendered by this page) also calls useAdminJobById internally
  // to resolve the currently-open detail modal's job — no modal is opened
  // in these tests, so a stub with no data is enough to satisfy the import.
  useAdminJobById: vi.fn().mockReturnValue({ data: undefined }),
}));

vi.mock('@modules/admin-panel/services/admin.service', () => ({
  adminService: { transitionJob: vi.fn(), qcReject: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { QCDashboardPage } from './QCDashboardPage';

const SUBMITTED_JOB: Job = {
  id: 'JC-0001',
  uuid: 'job-uuid-1',
  version: 4,
  rawStatus: 'SUBMITTED_TO_QC',
  ref: 'R-0001',
  client: 'Acme Co',
  clientId: 'client-1',
  design: 'Logo Redesign',
  summary: 'Logo for new product line',
  order: 'Artwork',
  project: 'Live',
  complexity: 'Medium',
  process: null,
  priority: 'Normal',
  etaHours: 24,
  status: 'In QC',
  stage: 'qc',
  assignedTo: 'Senior Designer',
  subType: 'Senior',
  notes: '',
  colors: 3,
  created: new Date().toISOString(),
  aiScore: null,
};

// JobTable simultaneously renders grid/list/table views (toggled via a CSS
// class JSDOM doesn't apply, since no stylesheet is loaded), so each row
// action appears multiple times in the DOM. Always act on the first (grid,
// the page's defaultView) instance.
function firstButton(name: RegExp) {
  return screen.getAllByRole('button', { name })[0]!;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <QCDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAdminJobViews).mockReturnValue({
    jobs: [SUBMITTED_JOB],
    total: 1,
    isLoading: false,
    isError: false,
    error: null,
  });
});

describe('QCDashboardPage — Approve', () => {
  it('opens the job (qc_open) then approves with the version qc_open returned', async () => {
    vi.mocked(adminService.transitionJob).mockImplementation(async (_uuid, action, version) => {
      if (action === 'qc_open') return { version: version + 1 } as any;
      return { version: version + 1 } as any;
    });

    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/approve/i));

    await waitFor(() => {
      expect(adminService.transitionJob).toHaveBeenNthCalledWith(1, 'job-uuid-1', 'qc_open', 4);
      expect(adminService.transitionJob).toHaveBeenNthCalledWith(2, 'job-uuid-1', 'qc_approve', 5);
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/approved.*locked.*routed to cs/i),
    );
  });

  it('skips qc_open when the job is already in QC_REVIEW (already opened by someone)', async () => {
    vi.mocked(useAdminJobViews).mockReturnValue({
      jobs: [{ ...SUBMITTED_JOB, rawStatus: 'QC_REVIEW' }],
      total: 1,
      isLoading: false,
      isError: false,
      error: null,
    });
    vi.mocked(adminService.transitionJob).mockResolvedValue({ version: 5 } as any);

    renderPage();
    const user = userEvent.setup();
    await user.click(firstButton(/approve/i));

    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledTimes(1));
    expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-1', 'qc_approve', 4);
  });

  it('surfaces a toast (not a crash) when approve hits an optimistic-lock conflict', async () => {
    const conflict = Object.assign(new Error('Job Card has been modified.'), { code: 'JOB_CARD_VERSION_MISMATCH' });
    vi.mocked(adminService.transitionJob).mockRejectedValue(conflict);

    renderPage();
    const user = userEvent.setup();
    await user.click(firstButton(/approve/i));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // The page itself must still be intact — Approve button still present, not crashed.
    expect(firstButton(/approve/i)).toBeInTheDocument();
  });
});

describe('QCDashboardPage — Reject', () => {
  it('requires feedback before allowing the reject to submit', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/reject/i));
    const dialog = await screen.findByRole('dialog');
    const rejectButton = within(dialog).getByRole('button', { name: /reject/i });

    expect(rejectButton).toBeDisabled();
    expect(adminService.qcReject).not.toHaveBeenCalled();
  });

  it('submits qc_reject with the selected reason and typed feedback, after opening the job', async () => {
    vi.mocked(adminService.transitionJob).mockResolvedValue({ version: 5 } as any);
    vi.mocked(adminService.qcReject).mockResolvedValue({} as any);

    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/reject/i));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByRole('combobox'), 'COLOUR');
    await user.type(within(dialog).getByRole('textbox'), 'Logo colour does not match the brand guide.');
    await user.click(within(dialog).getByRole('button', { name: /reject/i }));

    await waitFor(() => {
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-1', 'qc_open', 4);
      expect(adminService.qcReject).toHaveBeenCalledWith(
        'job-uuid-1',
        5,
        'COLOUR',
        'Logo colour does not match the brand guide.',
      );
    });
  });
});
