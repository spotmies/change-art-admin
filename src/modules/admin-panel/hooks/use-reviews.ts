import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import { reviewsService } from '../services/reviews.service';

export function useJobReviews(jobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.forJob(jobId ?? ''),
    queryFn: () => reviewsService.listForJob(jobId as string),
    enabled: !!jobId,
  });
}
