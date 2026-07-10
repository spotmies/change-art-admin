import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import { jobQueriesService } from '../services/job-queries.service';

export function useJobQueries(jobCardId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.queries.forJob(jobCardId ?? ''),
    queryFn: () => {
      if (!jobCardId) throw new Error('jobCardId is required');
      return jobQueriesService.listForJob(jobCardId);
    },
    enabled: !!jobCardId,
    staleTime: 0,
  });
}

export function useRaiseQuery(jobCardId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => {
      if (!jobCardId) return Promise.reject(new Error('No job selected'));
      return jobQueriesService.raiseQuery(jobCardId, message);
    },
    onSuccess: () => {
      if (jobCardId) {
        void qc.invalidateQueries({ queryKey: queryKeys.queries.forJob(jobCardId) });
        void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      }
    },
  });
}
