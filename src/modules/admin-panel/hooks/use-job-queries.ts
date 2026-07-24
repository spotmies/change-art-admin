import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import type { IJobQuery } from '@contracts';
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
  const user = useSessionUser();

  return useMutation({
    mutationFn: (message: string) => {
      if (!jobCardId) return Promise.reject(new Error('No job selected'));
      return jobQueriesService.raiseQuery(jobCardId, message);
    },
    // Show the message the instant Send is clicked instead of waiting on the
    // round trip (server write + invalidated refetch) — that compounded
    // latency, against a remote DB, is what read as a multi-second delay.
    onMutate: async (message) => {
      if (!jobCardId) return undefined;
      const key = queryKeys.queries.forJob(jobCardId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<IJobQuery[]>(key);
      const optimisticId = `optimistic-${Date.now()}`;

      const optimistic: IJobQuery = {
        id: optimisticId,
        tenant_id: user?.tenant_id ?? '',
        job_card_id: jobCardId,
        raised_by_user_id: user?.id ?? '',
        raised_by_role: 'ADMIN',
        message,
        is_resolved: false,
        created_at: new Date().toISOString(),
        raised_by_name: user?.name,
      };

      qc.setQueryData<IJobQuery[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous, optimisticId };
    },
    onError: (_err, _message, context) => {
      if (!jobCardId || !context) return;
      qc.setQueryData(queryKeys.queries.forJob(jobCardId), context.previous);
    },
    onSuccess: (created, _message, context) => {
      if (!jobCardId) return;
      qc.setQueryData<IJobQuery[]>(queryKeys.queries.forJob(jobCardId), (old) =>
        (old ?? []).map((q) => (q.id === context?.optimisticId ? created : q)),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    },
    onSettled: () => {
      if (jobCardId) void qc.invalidateQueries({ queryKey: queryKeys.queries.forJob(jobCardId) });
    },
  });
}
