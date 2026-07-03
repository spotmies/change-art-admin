import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { toastApiError, ValidationError } from '@lib/toast-error';
import { adminService, type ClientFilters, type CreateClientBody, type CreateJobCardBody, type ProvisionClientBody, type SendQuotePriceBody, type UpdateClientBody } from '../services/admin.service';

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

/** Admin-only: mark or unmark a client as Hotlisted. */
export function useSetClientHotlisted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hotlisted }: { id: string; hotlisted: boolean }) =>
      adminService.setClientHotlisted(id, hotlisted),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      toast.success(
        client.is_hotlisted
          ? `${client.company_name ?? client.client_name} is now Hotlisted`
          : `${client.company_name ?? client.client_name} is no longer Hotlisted`,
      );
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

export function useCreateJobCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateJobCardBody) => {
      if (!body.client_id?.trim()) throw new ValidationError('Client is required.');
      if (!body.mail?.trim()) throw new ValidationError('Client email is required.');
      if (!body.order_type?.trim()) throw new ValidationError('Order type is required.');
      if (!body.project_type?.trim()) throw new ValidationError('Project type is required.');
      if (!body.design_name?.trim()) throw new ValidationError('Design name is required.');
      return adminService.createJobCard(body);
    },
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.jobs.byId(job.id), job);
      void qc.invalidateQueries({ queryKey: ['jobs', 'list'] });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.badges() });
    },
    onError: (err) => toastApiError(err),
  });
}

export function useSendQuotePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: SendQuotePriceBody }) => {
      if (!jobId?.trim()) throw new ValidationError('Job ID is required.');
      if (!Number.isFinite(body.amount) || body.amount <= 0) throw new ValidationError('Amount must be a positive number.');
      return adminService.sendQuotePrice(jobId, body);
    },
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.jobs.byId(job.id), job);
      void qc.invalidateQueries({ queryKey: ['jobs', 'list'] });
    },
    onError: (err) => toastApiError(err),
  });
}

// ── Admin client approval workflow ────────────────────────────────────────────

/** Lists self-registered clients awaiting admin approval. */
export function usePendingClients() {
  return useQuery({
    queryKey: queryKeys.clients.pending(),
    queryFn: () => adminService.getPendingClients(),
    staleTime: 30 * 1000,
  });
}

/** Lists self-registered clients that have been approved by admin. */
export function useApprovedClients() {
  return useQuery({
    queryKey: queryKeys.clients.approved(),
    queryFn: () => adminService.getApprovedClients(),
    staleTime: 60 * 1000,
  });
}

/** Lists self-registered clients that have been rejected by admin. */
export function useRejectedClients() {
  return useQuery({
    queryKey: queryKeys.clients.rejected(),
    queryFn: () => adminService.getRejectedClients(),
    staleTime: 60 * 1000,
  });
}

/** Mutation to approve a pending client (optionally override the client_id). */
export function useApproveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId }: { id: string; clientId?: string }) =>
      adminService.approveClient(id, clientId),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.clients.pending() });
      void qc.invalidateQueries({ queryKey: queryKeys.clients.approved() });
      toast.success(`${client.company_name ?? client.client_name} approved — they can now log in.`);
    },
    onError: (err) => toastApiError(err),
  });
}

/** Mutation to reject a pending client signup (sends rejection email with note). */
export function useRejectClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      adminService.rejectClient(id, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.clients.pending() });
      void qc.invalidateQueries({ queryKey: queryKeys.clients.rejected() });
      toast.success('Client registration rejected. Rejection email sent.');
    },
    onError: (err) => toastApiError(err),
  });
}

/**
 * Real-time uniqueness check for a proposed client_id.
 * Only fires when the input is exactly 5 digits.
 */
export function useCheckClientId(clientId: string, excludeId?: string) {
  const isValid = /^\d{5}$/.test(clientId);
  return useQuery({
    queryKey: ['clients', 'check-id', clientId, excludeId],
    queryFn: () => adminService.checkClientIdAvailable(clientId, excludeId),
    enabled: isValid,
    staleTime: 10 * 1000,
  });
}
