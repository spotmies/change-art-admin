import { apiClient } from '@lib/api-client';
import type { IJobQuery } from '@contracts';

export const jobQueriesService = {
  async listForJob(jobCardId: string): Promise<IJobQuery[]> {
    try {
      return await apiClient.get<IJobQuery[]>(`/api/v1/job-cards/${jobCardId}/queries`);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to load queries');
    }
  },

  async raiseQuery(jobCardId: string, message: string): Promise<IJobQuery> {
    try {
      return await apiClient.post<IJobQuery>(`/api/v1/job-cards/${jobCardId}/queries`, { message });
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to send query');
    }
  },
};
