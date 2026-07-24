import { apiClient } from '@lib/api-client';

export interface PerformanceReportRow {
  user_id: string;
  name: string;
  role: string;
  sub_type: string | null;
  total_jobs: number;
  completed: number;
  qc_rejection_rate: number | null;
  team_lead_rejection_rate: number | null;
  avg_turnaround_hours: number | null;
}

export interface QcRejectionReportRow {
  reason: string | null;
  count: number;
}

/** Historical reporting rollup — ChangeArt-New-PRD.md §5.3 #6, §5.4/§5.5, §5.8 #3. */
export const analyticsService = {
  performanceReport(): Promise<PerformanceReportRow[]> {
    return apiClient.get<PerformanceReportRow[]>('/api/v1/analytics/reports/performance');
  },

  myPerformance(): Promise<PerformanceReportRow | null> {
    return apiClient.get<PerformanceReportRow | null>('/api/v1/analytics/reports/performance/mine');
  },

  qcRejectionReport(): Promise<QcRejectionReportRow[]> {
    return apiClient.get<QcRejectionReportRow[]>('/api/v1/analytics/reports/qc-rejection');
  },
};
