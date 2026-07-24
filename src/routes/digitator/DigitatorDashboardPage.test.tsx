/**
 * DigitatorDashboardPage — component test (PRD §2.6).
 *
 * Same shape as DesignerDashboardPage.test.tsx, adapted for Digitizing's
 * extra branch: a Senior's direct submit auto-routes to Sewout when the
 * order is Digitizing + Sewout, or straight to QC otherwise (§1.5 — keyed
 * off sewoutRequired, mirrored client-side off job.order here).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Job } from '@modules/shared-ui';

vi.mock('@modules/auth/stores/auth-store', () => ({
  useSessionUser: vi.fn(),
}));

vi.mock('@modules/admin-panel/hooks/use-admin-jobs', () => ({
  useAdminJobViews: vi.fn(),
  useAdminJobById: vi.fn().mockReturnValue({ data: undefined }),
}));

vi.mock('@modules/admin-panel/hooks/use-reviews', () => ({
  useJobReviews: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));

vi.mock('@modules/admin-panel/services/admin.service', () => ({
  adminService: { transitionJob: vi.fn() },
}));

vi.mock('@modules/cs-panel/services/cs-quote.service', () => ({
  uploadCompletedFile: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { useSessionUser } from '@modules/auth/stores/auth-store';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { DigitatorDashboardPage } from './DigitatorDashboardPage';

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'JC-0005',
    uuid: 'job-uuid-5',
    version: 3,
    rawStatus: 'IN_PROGRESS',
    ref: 'R-0005',
    client: 'Acme Co',
    clientId: 'client-1',
    design: 'Cap Digitizing',
    summary: 'Front-of-cap digitizing file',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 24,
    status: 'In Production',
    stage: 'senior',
    assignedTo: 'Sam Senior',
    subType: 'Senior',
    notes: '',
    colors: 3,
    created: new Date().toISOString(),
    aiScore: null,
    ...overrides,
  };
}

function firstButton(name: RegExp) {
  return screen.getAllByRole('button', { name })[0]!;
}

function mockJobs(jobs: Job[]) {
  vi.mocked(useAdminJobViews).mockReturnValue({ jobs, total: jobs.length, isLoading: false, isError: false, error: null });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DigitatorDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSessionUser).mockReturnValue({ id: 'digitator-1', name: 'Sam Senior', sub_type: 'SENIOR' } as any);
  vi.mocked(adminService.transitionJob).mockResolvedValue({} as any);
});

describe('DigitatorDashboardPage — Senior direct submit routing', () => {
  it('shows "To QC" and fires senior_direct_submit for a Digitizing-only order', async () => {
    mockJobs([baseJob({ order: 'Digitizing', version: 4 })]);
    renderPage();
    const user = userEvent.setup();

    expect(firstButton(/to qc/i)).toBeInTheDocument();
    await user.click(firstButton(/to qc/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-5', 'senior_direct_submit', 4),
    );
  });

  it('shows "To Sewout" and fires senior_direct_to_sewout for a Digitizing + Sewout order', async () => {
    mockJobs([baseJob({ order: 'Digitizing + Sewout', version: 4 })]);
    renderPage();
    const user = userEvent.setup();

    expect(firstButton(/to sewout/i)).toBeInTheDocument();
    await user.click(firstButton(/to sewout/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-5', 'senior_direct_to_sewout', 4),
    );
  });
});

describe('DigitatorDashboardPage — Junior submit', () => {
  it('fires submit_to_team_lead for a Junior regardless of sewout routing', async () => {
    vi.mocked(useSessionUser).mockReturnValue({ id: 'digitator-2', name: 'Jamie Junior', sub_type: 'JUNIOR' } as any);
    mockJobs([baseJob({ order: 'Digitizing + Sewout', subType: 'Junior', version: 6 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/to sewout/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-5', 'submit_to_team_lead', 6),
    );
  });
});

describe('DigitatorDashboardPage — Accept and Rework', () => {
  it('fires accept for an ASSIGNED job', async () => {
    mockJobs([baseJob({ rawStatus: 'ASSIGNED', version: 2 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/accept/i));
    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-5', 'accept', 2));
  });

  it('fires rework_after_qc for a QC-rejected job', async () => {
    mockJobs([baseJob({ rawStatus: 'QC_REJECTED', version: 8 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/start rework/i));
    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-5', 'rework_after_qc', 8));
  });
});
