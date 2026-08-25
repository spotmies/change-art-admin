import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  clientGroupsService,
  type CreateClientGroupPayload,
  type UpdateClientGroupPayload,
} from '../services/client-groups.service';

export const CLIENT_GROUPS_QUERY_KEY = ['client-groups'];

export function useClientGroups() {
  return useQuery({
    queryKey: CLIENT_GROUPS_QUERY_KEY,
    queryFn: () => clientGroupsService.list(),
    staleTime: 30_000,
  });
}

export function useClientGroupById(id: string | null | undefined) {
  return useQuery({
    queryKey: [...CLIENT_GROUPS_QUERY_KEY, id],
    queryFn: () => (id ? clientGroupsService.getById(id) : null),
    enabled: Boolean(id),
  });
}

export function useCreateClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientGroupPayload) => clientGroupsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_GROUPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client Group created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create Client Group');
    },
  });
}

export function useUpdateClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClientGroupPayload }) =>
      clientGroupsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_GROUPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client Group updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update Client Group');
    },
  });
}

export function useDeleteClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientGroupsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_GROUPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client Group deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete Client Group');
    },
  });
}
