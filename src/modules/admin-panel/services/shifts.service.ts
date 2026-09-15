import { apiClient } from '@lib/api-client';
import type { IShift } from '@contracts';

export interface CreateShiftPayload {
  name: string;
  start_time: string;
  end_time: string;
}

export interface UpdateShiftPayload {
  name?: string;
  start_time?: string;
  end_time?: string;
}

export const shiftsService = {
  async list(): Promise<IShift[]> {
    return apiClient.get<IShift[]>('/api/v1/shifts');
  },

  async create(payload: CreateShiftPayload): Promise<IShift> {
    return apiClient.post<IShift, CreateShiftPayload>('/api/v1/shifts', payload);
  },

  async update(id: string, payload: UpdateShiftPayload): Promise<IShift> {
    return apiClient.patch<IShift, UpdateShiftPayload>(`/api/v1/shifts/${id}`, payload);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/shifts/${id}`);
  },
};
