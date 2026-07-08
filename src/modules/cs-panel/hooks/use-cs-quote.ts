import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { ApiClientError } from '@lib/api-client';
import { toastApiError, ValidationError } from '@lib/toast-error';
import {
  csQuoteService,
  type SendQuotePriceBody,
  type RejectQuoteBody,
  type DispatchJobBody,
  type MarkCompleteBody,
} from '../services/cs-quote.service';

export type { SendQuotePriceBody, RejectQuoteBody, DispatchJobBody, MarkCompleteBody };

export function useSendQuotePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: SendQuotePriceBody }) => {
      if (!jobId?.trim()) throw new ValidationError('Job ID is required.');
      if (!Number.isFinite(body.amount) || body.amount <= 0) throw new ValidationError('Amount must be a positive number.');
      return csQuoteService.sendQuotePrice(jobId, body);
    },
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.jobs.byId(job.id), job);
      void qc.invalidateQueries({ queryKey: ['jobs', 'list'] });
      void qc.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      toast.success('Price sent to client for confirmation.');
    },
    onError: (err, { jobId }) => {
      // Someone else (another CS rep, or Admin) won the race and already sent
      // a price for this job — refetch so the modal drops the stale "send
      // price" form and shows what actually happened instead of leaving the
      // user staring at an outdated view they could resubmit into again.
      if (err instanceof ApiClientError && err.code === 'JOB_CARD_VERSION_MISMATCH') {
        void qc.invalidateQueries({ queryKey: queryKeys.jobs.byId(jobId) });
        void qc.invalidateQueries({ queryKey: ['jobs', 'list'] });
      }
      toastApiError(err);
    },
  });
}

export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body?: RejectQuoteBody }) =>
      csQuoteService.rejectQuote(jobId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      toast.success('Quote rejected.');
    },
    onError: (err) => toastApiError(err),
  });
}

export function useDispatchJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body?: DispatchJobBody }) =>
      csQuoteService.dispatchJob(jobId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success('Job dispatched to client.');
    },
    onError: (err) => toastApiError(err),
  });
}

export function useMarkComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body?: MarkCompleteBody }) =>
      csQuoteService.markComplete(jobId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success('Job marked complete — ready to deliver.');
    },
    onError: (err) => toastApiError(err),
  });
}

export function useNotifyOrderReady() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, fileIds, note }: { jobId: string; fileIds: string[]; note?: string }) =>
      csQuoteService.notifyOrderReady(jobId, { file_ids: fileIds, note }),
    onSuccess: (data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.byId(variables.jobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success(`Order ready email sent to ${data.to}`);
    },
    onError: (err) => toastApiError(err),
  });
}

export function useAcknowledgeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, etaHours }: { jobId: string; etaHours?: number }) =>
      csQuoteService.acknowledgeJob(jobId, etaHours),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.byId(variables.jobId) });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      toast.success('Acknowledgement sent — ETA countdown has started.');
    },
    onError: (err) => toastApiError(err),
  });
}
