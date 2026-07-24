import { useQuery } from '@tanstack/react-query';
import { reviewsService, type ReviewHistoryFilters } from '../services/reviews.service';

export function useReviewHistory(filters: ReviewHistoryFilters = {}) {
  return useQuery({
    queryKey: ['reviews', 'history', filters],
    queryFn: () => reviewsService.history(filters),
  });
}
