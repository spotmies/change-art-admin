import { apiClient } from '@lib/api-client';
import type { IReview, PaginatedList } from '@contracts';

export interface ReviewHistoryRow extends IReview {
  job_reference_number: string;
  job_design_name: string;
  reviewer_name: string | null;
}

export interface ReviewHistoryFilters {
  review_type?: 'TEAM_LEAD_REVIEW' | 'QC_REVIEW';
  decision?: 'APPROVED' | 'REJECTED';
  page?: number;
  per_page?: number;
}

export const reviewsService = {
  listForJob(jobId: string): Promise<IReview[]> {
    return apiClient.get<IReview[]>(`/api/v1/reviews/job/${jobId}`);
  },

  history(filters: ReviewHistoryFilters = {}): Promise<PaginatedList<ReviewHistoryRow>> {
    return apiClient.getPaginated<ReviewHistoryRow>('/api/v1/reviews/history', {
      params: { per_page: 50, ...filters },
    });
  },
};
