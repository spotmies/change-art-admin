import { apiClient } from '@lib/api-client';
import type { IFileVersion, IJobCard } from '@contracts';
import { FileCategory } from '@contracts';

export interface SendQuotePriceBody {
  amount: number;          // required, positive
  currency?: string;       // optional, defaults to 'USD' server-side
  note?: string;           // optional, max 500 chars
  etaHours?: number;       // optional, saved to eta_hours on the job card
}

export interface ApproveJobBody {
  etaHours: number;  // required — Direct Order Placement fixes ETA at this step (price already known)
  note?: string;
}

export interface RejectQuoteBody {
  reason?: string;
}

export interface DispatchJobBody {
  note?: string;
}

export interface MarkCompleteBody {
  stitch_count?: number;
  note?: string;
}

export interface PresignResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

/** Upload a file to S3 as a COMPLETED file and return its DB record id. */
export async function uploadCompletedFile(jobId: string, file: File): Promise<string> {
  const presign = await apiClient.post<PresignResponse, object>('/api/v1/files/upload-url', {
    job_card_id: jobId,
    file_category: FileCategory.COMPLETED,
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
  });

  await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });

  const registered = await apiClient.post<IFileVersion>('/api/v1/files/complete-upload', {
    job_card_id: jobId,
    storage_key: presign.storageKey,
    file_category: FileCategory.COMPLETED,
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
  });

  return registered.id;
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

  approveJob(jobId: string, body: ApproveJobBody): Promise<IJobCard> {
    return apiClient.post<IJobCard, ApproveJobBody>(
      `/api/v1/cs/jobs/${jobId}/approve`,
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

  markComplete(jobId: string, body: MarkCompleteBody = {}): Promise<IJobCard> {
    return apiClient.post<IJobCard, MarkCompleteBody>(
      `/api/v1/cs/jobs/${jobId}/complete`,
      body,
    );
  },

  notifyOrderReady(
    jobId: string,
    body: { file_ids: string[]; note?: string },
  ): Promise<{ sent: boolean; to: string }> {
    return apiClient.post<{ sent: boolean; to: string }, typeof body>(
      `/api/v1/cs/jobs/${jobId}/notify-ready`,
      body,
    );
  },

  /** CS bypass (cs_complete) feature flag — PRD §1.6/§4 item 5. Defaults to enabled. */
  getBypassSetting(): Promise<{ enabled: boolean }> {
    return apiClient.get<{ enabled: boolean }>('/api/v1/cs/bypass-setting');
  },

  setBypassSetting(enabled: boolean): Promise<{ enabled: boolean }> {
    return apiClient.put<{ enabled: boolean }, { enabled: boolean }>('/api/v1/cs/bypass-setting', { enabled });
  },
};
