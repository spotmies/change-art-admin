import { apiClient } from '@lib/api-client';
import type { IClientGroup } from '@contracts';

export interface CreateClientGroupPayload {
  name: string;
  description?: string | null;
  show_in_quote?: boolean;
  show_in_orders?: boolean;
  client_ids?: string[];
}

export interface UpdateClientGroupPayload {
  name?: string;
  description?: string | null;
  show_in_quote?: boolean;
  show_in_orders?: boolean;
  client_ids?: string[];
}

export const clientGroupsService = {
  async list(): Promise<IClientGroup[]> {
    return apiClient.get<IClientGroup[]>('/api/v1/client-groups');
  },

  async getById(id: string): Promise<IClientGroup> {
    return apiClient.get<IClientGroup>(`/api/v1/client-groups/${id}`);
  },

  async create(payload: CreateClientGroupPayload): Promise<IClientGroup> {
    return apiClient.post<IClientGroup, CreateClientGroupPayload>('/api/v1/client-groups', payload);
  },

  async update(id: string, payload: UpdateClientGroupPayload): Promise<IClientGroup> {
    return apiClient.put<IClientGroup, UpdateClientGroupPayload>(`/api/v1/client-groups/${id}`, payload);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/client-groups/${id}`);
  },
};
