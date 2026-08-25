import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import { jobNotesService } from '../services/job-notes.service';

export function useJobNotes(jobCardId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.jobNotes.forJob(jobCardId ?? ''),
    queryFn: () => {
      if (!jobCardId) throw new Error('jobCardId is required');
      return jobNotesService.listForJob(jobCardId);
    },
    enabled: !!jobCardId,
    staleTime: 0,
  });
}

export function useAddJobNote(jobCardId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => {
      if (!jobCardId) return Promise.reject(new Error('No job selected'));
      return jobNotesService.addNote(jobCardId, text);
    },
    onSuccess: () => {
      if (jobCardId) {
        void qc.invalidateQueries({ queryKey: queryKeys.jobNotes.forJob(jobCardId) });
      }
    },
  });
}
