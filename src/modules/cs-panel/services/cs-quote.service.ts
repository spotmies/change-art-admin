import { apiClient } from '@lib/api-client';
import type { IJobCard } from '@contracts';

export interface SendQuotePriceBody {
  amount: number;          // required, positive
  currency?: string;       // optional, defaults to 'USD' server-side
  note?: string;           // optional, max 500 chars
  etaHours?: number;       // optional, saved to eta_hours on the job card
}

export interface RejectQuoteBody {
  reason?: string;
}

export interface DispatchJobBody {
  note?: string;
}

/**
 * CS quote / dispatch endpoints — see BACKEND_CS_QUOTE_DISPATCH_REQUIRED.md.
 * The CS rep (or admin) sets a price on a quote-stage job, rejects a quote,
 * or dispatches a QC-stage job to the client.
 */
export const csQuoteService = {
  sendQuotePrice(jobId: string, body: SendQuotePriceBody): Promise<IJobCard> {
    return apiClient.post<IJobCard, SendQuotePriceBody>(
      `/api/v1/cs/jobs/${jobId}/quote/send-price`,
      body,
    );
  },

  rejectQuote(jobId: string, body: RejectQuoteBody = {}): Promise<IJobCard> {
    return apiClient.post<IJobCard, RejectQuoteBody>(
      `/api/v1/cs/jobs/${jobId}/quote/reject`,
      body,
    );
  },

  dispatchJob(jobId: string, body: DispatchJobBody = {}): Promise<IJobCard> {
    return apiClient.post<IJobCard, DispatchJobBody>(
      `/api/v1/cs/jobs/${jobId}/dispatch`,
      body,
    );
  },

  acknowledgeJob(jobId: string, etaHours?: number): Promise<IJobCard> {
    return apiClient.post<IJobCard, { etaHours?: number }>(
      `/api/v1/cs/jobs/${jobId}/acknowledge`,
      etaHours != null ? { etaHours } : {},
    );
  },
};
