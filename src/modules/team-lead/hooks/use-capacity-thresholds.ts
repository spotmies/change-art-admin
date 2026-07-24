import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { toastApiError } from '@lib/toast-error';
import { staffDirectoryService, type CapacityThresholds } from '../services/staff-directory.service';

const QUERY_KEY = ['staff-directory', 'capacity-thresholds'];

export function useCapacityThresholds() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => staffDirectoryService.getCapacityThresholds(),
  });
}

export function useUpdateCapacityThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thresholds: CapacityThresholds) => staffDirectoryService.setCapacityThresholds(thresholds),
    onSuccess: (thresholds) => {
      qc.setQueryData(QUERY_KEY, thresholds);
      void qc.invalidateQueries({ queryKey: ['staff-directory'] });
      toast.success('Capacity thresholds updated.');
    },
    onError: (err) => toastApiError(err),
  });
}
