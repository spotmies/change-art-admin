/**
 * TeamLeadQueuePage — component test (PRD §1.10, §5.3).
 *
 * Renders the real Assignment Queue against a mocked job list, opens the
 * Assign modal, picks a staff member, and verifies it fires the same
 * `assign` action (useAssignJob → assignmentsApi.create) CS's Staff
 * Directory view uses — Team Lead and CS share one queue, not two.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Job } from '@modules/shared-ui';

vi.mock('@modules/admin-panel/hooks/use-admin-jobs', () => ({
  useAdminJobViews: vi.fn(),
  useAdminJobById: vi.fn().mockReturnValue({ data: undefined }),
  useAdminUsers: vi.fn(),
}));

vi.mock('@modules/admin-panel/hooks/use-assignments', () => ({
  useAssignJob: vi.fn(),
}));

vi.mock('@modules/team-lead/services/staff-directory.service', () => ({
  staffDirectoryService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { useAdminJobViews, useAdminUsers } from '@modules/admin-panel/hooks/use-admin-jobs';
import { useAssignJob } from '@modules/admin-panel/hooks/use-assignments';
import { TeamLeadQueuePage } from './TeamLeadQueuePage';

const QUEUED_JOB: Job = {
  id: 'JC-0006',
  uuid: 'job-uuid-6',
  version: 1,
  rawStatus: 'CS_APPROVED',
  ref: 'R-0006',
  client: 'Acme Co',
  clientId: 'client-1',
  design: 'Poster Design',
  summary: 'Event poster',
  order: 'Artwork',
  project: 'Live',
  complexity: 'Medium',
  process: null,
  priority: 'Normal',
  etaHours: 24,
  status: 'In Production',
  stage: 'junior',
  assignedTo: null,
  subType: null,
  notes: '',
  colors: 3,
  created: new Date().toISOString(),
  aiScore: null,
};

const JUNIOR_DESIGNER = { id: 'junior-1', name: 'Jamie Junior', role: 'DESIGNER', sub_type: 'JUNIOR', is_active: true };

function firstButton(name: RegExp) {
  return screen.getAllByRole('button', { name })[0]!;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TeamLeadQueuePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAdminJobViews).mockReturnValue({
    jobs: [QUEUED_JOB],
    total: 1,
    isLoading: false,
    isError: false,
    error: null,
  });
  vi.mocked(useAdminUsers).mockReturnValue({
    data: { items: [JUNIOR_DESIGNER], total: 1, page: 1, per_page: 100 },
    isLoading: false,
    isError: false,
  } as any);
});

describe('TeamLeadQueuePage', () => {
  it('opens the Assign modal and fires the assign action with the picked staff member', async () => {
    const mutate = vi.fn((_body, opts) => opts?.onSuccess?.());
    vi.mocked(useAssignJob).mockReturnValue({ mutate, isPending: false } as any);

    renderPage();
    const user = userEvent.setup();

    await user.click(firstButton(/^assign/i));
    await screen.findByText(/junior designer/i);
    await user.click(screen.getByText('Jamie Junior'));
    await user.click(screen.getByRole('button', { name: /confirm assignment/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ job_card_id: 'job-uuid-6', assigned_to: 'junior-1' }),
        expect.anything(),
      ),
    );
  });
});
