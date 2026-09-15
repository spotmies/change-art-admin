import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ApiClientError } from '@lib/api-client';
import {
  shiftsService,
  type CreateShiftPayload,
  type UpdateShiftPayload,
} from '../services/shifts.service';

export const SHIFTS_QUERY_KEY = ['shifts'];

function toMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.toUserMessage() : fallback;
}

export function useShifts() {
  return useQuery({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: () => shiftsService.list(),
    staleTime: 30_000,
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateShiftPayload) => shiftsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
      toast.success('Shift created.');
    },
    onError: (err: unknown) => {
      toast.error(toMessage(err, 'Failed to create shift.'));
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateShiftPayload }) =>
      shiftsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
      toast.success('Shift updated.');
    },
    onError: (err: unknown) => {
      toast.error(toMessage(err, 'Failed to update shift.'));
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => shiftsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
      toast.success('Shift deleted.');
    },
    onError: (err: unknown) => {
      toast.error(toMessage(err, 'Failed to delete shift.'));
    },
  });
}
