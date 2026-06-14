import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { adminService, type ClientFilters, type CreateClientBody, type ProvisionClientBody, type UpdateClientBody } from '../services/admin.service';

export function useAdminClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: queryKeys.clients.list(filters as Record<string, unknown>),
    queryFn: () => adminService.getClients(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientBody) => adminService.createClient(body),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      toast.success(`${client.company_name ?? client.client_name} added`);
    },
    onError: (err) => toastApiError(err),
  });
}

export function useProvisionClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProvisionClientBody) => adminService.provisionClient(body),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      toast.success(`${client.company_name ?? client.client_name} provisioned`);
    },
    onError: (err) => toastApiError(err),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateClientBody }) =>
      adminService.updateClient(id, body),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      toast.success(`${client.company_name ?? client.client_name} updated`);
    },
    onError: (err) => toastApiError(err),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteClient(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      toast.success('Client deleted');
    },
    // Surfaces CLIENT_HAS_JOBS ("Cannot delete a client with associated Job Cards.")
    onError: (err) => toastApiError(err),
  });
}
