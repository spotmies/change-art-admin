import { apiClient } from '@lib/api-client';
import type { IUser } from '@contracts';

export interface StaffJobBrief {
  job_card_id: string;
  reference_number: string;
  design_name: string;
  client_name: string | null;
  order_type: string;
  status: string;
  eta_hours: number | null;
  deadline_at: string | null;
  at_risk: boolean;
}

export interface StaffDirectoryEntry {
  user: IUser;
  availability: 'FREE' | 'BUSY' | 'OVERLOADED';
  active_job_count: number;
  capacity: number;
  jobs: StaffJobBrief[];
  last_activity_at: string | null;
}

export interface CapacityThresholds {
  DESIGNER_JUNIOR: number;
  DESIGNER_SENIOR: number;
  DIGITATOR_JUNIOR: number;
  DIGITATOR_SENIOR: number;
  SEWOUT: number;
}

/** Team Lead + CS Staff Directory — see ChangeArt-New-PRD.md §1.10. */
export const staffDirectoryService = {
  list(role?: 'DESIGNER' | 'DIGITATOR' | 'SEWOUT'): Promise<StaffDirectoryEntry[]> {
    return apiClient.get<StaffDirectoryEntry[]>('/api/v1/staff-directory', {
      params: role ? { role } : {},
    });
  },

  getCapacityThresholds(): Promise<CapacityThresholds> {
    return apiClient.get<CapacityThresholds>('/api/v1/staff-directory/capacity-thresholds');
  },

  setCapacityThresholds(thresholds: CapacityThresholds): Promise<CapacityThresholds> {
    return apiClient.put<CapacityThresholds, CapacityThresholds>(
      '/api/v1/staff-directory/capacity-thresholds',
      thresholds,
    );
  },
};
