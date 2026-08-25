import { apiClient } from '@lib/api-client';
import type { IJobNote } from '@contracts';

export const jobNotesService = {
  async listForJob(jobCardId: string): Promise<IJobNote[]> {
    try {
      return await apiClient.get<IJobNote[]>(`/api/v1/job-cards/${jobCardId}/notes`);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to load internal notes');
    }
  },

  async addNote(jobCardId: string, text: string): Promise<IJobNote> {
    try {
      return await apiClient.post<IJobNote>(`/api/v1/job-cards/${jobCardId}/notes`, { text });
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add internal note');
    }
  },
};
