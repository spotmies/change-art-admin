/**
 * DesignerDashboardPage — component test (PRD §2.4/§2.5, §5.4/§5.5).
 *
 * Verifies: Accept fires `accept` with the job's version; submitting a
 * Junior's work fires `submit_to_team_lead` (Team Lead review, not a Senior
 * reviewer — see §0 2026-07-15 update); a Senior's direct submit fires
 * `senior_direct_submit` (non-sewout) or `senior_direct_to_sewout`
 * (Digitizing + Sewout order); and the Rework Queue fires `rework_after_qc`
 * for a QC rejection vs plain `rework` for a Team Lead rejection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
import { DesignerDashboardPage } from './DesignerDashboardPage';

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'JC-0004',
    uuid: 'job-uuid-4',
    version: 3,
    rawStatus: 'ASSIGNED',
    ref: 'R-0004',
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
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Junior Designer',
    subType: 'Junior',
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
        <DesignerDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSessionUser).mockReturnValue({ id: 'designer-1', name: 'Jamie Junior', sub_type: 'JUNIOR' } as any);
  vi.mocked(adminService.transitionJob).mockResolvedValue({} as any);
});

describe('DesignerDashboardPage — Accept', () => {
  it('fires accept with the job current version', async () => {
    mockJobs([baseJob({ rawStatus: 'ASSIGNED', version: 3 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/accept/i));

    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'accept', 3));
  });
});

describe('DesignerDashboardPage — Submit (Junior → Team Lead)', () => {
  it('fires submit_to_team_lead for a Junior, not a Senior review action', async () => {
    mockJobs([baseJob({ rawStatus: 'IN_PROGRESS', subType: 'Junior', version: 3 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/^submit$/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'submit_to_team_lead', 3),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/submitted to team lead/i));
  });
});

describe('DesignerDashboardPage — Submit (Senior direct)', () => {
  beforeEach(() => {
    vi.mocked(useSessionUser).mockReturnValue({ id: 'designer-2', name: 'Sam Senior', sub_type: 'SENIOR' } as any);
  });

  it('fires senior_direct_submit for a non-sewout order', async () => {
    mockJobs([baseJob({ rawStatus: 'IN_PROGRESS', subType: 'Senior', order: 'Artwork', version: 7 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/^submit$/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'senior_direct_submit', 7),
    );
  });

  it('fires senior_direct_to_sewout for a Digitizing + Sewout order', async () => {
    mockJobs([baseJob({ rawStatus: 'IN_PROGRESS', subType: 'Senior', order: 'Digitizing + Sewout', version: 7 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/^submit$/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^submit$/i }));

    await waitFor(() =>
      expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'senior_direct_to_sewout', 7),
    );
  });
});

describe('DesignerDashboardPage — Rework Queue', () => {
  it('fires rework_after_qc for a QC-rejected job', async () => {
    mockJobs([baseJob({ rawStatus: 'QC_REJECTED', version: 9 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/start rework/i));

    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'rework_after_qc', 9));
  });

  it('fires plain rework for a Team-Lead-rejected job', async () => {
    mockJobs([baseJob({ rawStatus: 'TEAM_LEAD_REJECTED', version: 9 })]);
    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/start rework/i));

    await waitFor(() => expect(adminService.transitionJob).toHaveBeenCalledWith('job-uuid-4', 'rework', 9));
  });
});
