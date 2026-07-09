import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import { settingsService } from '../services/settings.service';

/** The tenant's single active Credit Card Authorization Form template, or null if none uploaded. */
export function useCcForm() {
  return useQuery({
    queryKey: queryKeys.settings.ccForm(),
    queryFn: () => settingsService.getCcForm(),
    staleTime: 60 * 1000,
  });
}

/** Admin: upload (or replace) the tenant's CC Authorization Form. */
export function useUploadCcForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => settingsService.uploadCcForm(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.settings.ccForm() });
      toast.success('CC Authorization Form uploaded');
    },
    onError: (err) => toastApiError(err),
  });
}

/** Admin: delete the tenant's CC Authorization Form. */
export function useDeleteCcForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settingsService.deleteCcForm(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.settings.ccForm() });
      toast.success('CC Authorization Form deleted');
    },
    onError: (err) => toastApiError(err),
  });
}
