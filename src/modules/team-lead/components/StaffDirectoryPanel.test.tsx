/**
 * StaffDirectoryPanel — component test (PRD §1.10).
 *
 * Renders real data from mocked services (staff-directory + admin-panel's
 * user list + assignments), verifies availability badges and the at-risk
 * flag render correctly, and that clicking "Reassign" → picking a candidate
 * fires the same `assign` action (useAssignJob → assignmentsApi.create)
 * Team Lead and CS both use, with the correct job/assignee payload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../services/staff-directory.service', () => ({
  staffDirectoryService: { list: vi.fn() },
}));

vi.mock('@modules/admin-panel/services/admin.service', () => ({
  adminService: { getUsers: vi.fn() },
}));

vi.mock('@modules/admin-panel/services/assignments.service', () => ({
  assignmentsApi: { create: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { staffDirectoryService } from '../services/staff-directory.service';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { assignmentsApi } from '@modules/admin-panel/services/assignments.service';
import { StaffDirectoryPanel } from './StaffDirectoryPanel';

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StaffDirectoryPanel />
    </QueryClientProvider>,
  );
}

const FREE_DESIGNER = {
  user: { id: 'd-free', name: 'Priya Sharma', role: 'DESIGNER', sub_type: 'JUNIOR' },
  availability: 'FREE',
  active_job_count: 0,
  capacity: 2,
  jobs: [],
  last_activity_at: null,
};

const OVERLOADED_DIGITATOR = {
  user: { id: 'd-over', name: 'Raj Patel', role: 'DIGITATOR', sub_type: 'SENIOR' },
  availability: 'OVERLOADED',
  active_job_count: 3,
  capacity: 3,
  jobs: [
    {
      job_card_id: 'job-1',
      reference_number: 'R-0001',
      design_name: 'Logo',
      client_name: 'Acme Co',
      order_type: 'DIGITIZING',
      status: 'IN_PROGRESS',
      eta_hours: 24,
      deadline_at: new Date().toISOString(),
      at_risk: true,
    },
  ],
  last_activity_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StaffDirectoryPanel', () => {
  it('shows a loading state, then renders staff cards from the mocked service', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([FREE_DESIGNER, OVERLOADED_DIGITATOR] as any);

    renderPanel();

    expect(screen.getByText(/loading staff/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeInTheDocument());
    expect(screen.getByText('Raj Patel')).toBeInTheDocument();
  });

  it('renders the correct availability badge per staff member', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([FREE_DESIGNER, OVERLOADED_DIGITATOR] as any);
    renderPanel();

    await waitFor(() => expect(screen.getByText('Free')).toBeInTheDocument());
    expect(screen.getByText('Overloaded')).toBeInTheDocument();
  });

  it('flags an at-risk job with the "at risk" indicator', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([OVERLOADED_DIGITATOR] as any);
    renderPanel();

    await waitFor(() => expect(screen.getByText(/1 at risk/i)).toBeInTheDocument());
  });

  it('shows an empty state when there is no active staff', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([] as any);
    renderPanel();

    await waitFor(() => expect(screen.getByText(/no active producers found/i)).toBeInTheDocument());
  });

  it('shows an error state when the service call fails', async () => {
    vi.mocked(staffDirectoryService.list).mockRejectedValue(new Error('network error'));
    renderPanel();

    await waitFor(() => expect(screen.getByText(/failed to load staff directory/i)).toBeInTheDocument());
  });

  it('reassigning a job fires the assign action with the picked candidate and the job id', async () => {
    vi.mocked(staffDirectoryService.list).mockResolvedValue([OVERLOADED_DIGITATOR] as any);
    vi.mocked(adminService.getUsers).mockResolvedValue({
      items: [
        { id: 'd-free-candidate', name: 'Ana Lee', role: 'DIGITATOR', sub_type: 'JUNIOR', is_active: true },
        // Same role as the overloaded staffer themselves — must be excluded as a candidate.
        { id: 'd-over', name: 'Raj Patel', role: 'DIGITATOR', sub_type: 'SENIOR', is_active: true },
      ],
      total: 2,
      page: 1,
      per_page: 100,
    } as any);
    vi.mocked(assignmentsApi.create).mockResolvedValue({} as any);

    renderPanel();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Raj Patel')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /reassign/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /ana lee/i })).toBeInTheDocument());
    // The overloaded staffer themselves must not appear as a reassignment candidate.
    expect(screen.queryByRole('button', { name: /^raj patel/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ana lee/i }));

    await waitFor(() =>
      expect(assignmentsApi.create).toHaveBeenCalledWith({
        job_card_id: 'job-1',
        assigned_to: 'd-free-candidate',
      }),
    );
  });
});
