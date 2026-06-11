import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import {
  csQuoteService,
  type SendQuotePriceBody,
  type RejectQuoteBody,
  type DispatchJobBody,
} from '../services/cs-quote.service';

export type { SendQuotePriceBody, RejectQuoteBody, DispatchJobBody };

export function useSendQuotePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: SendQuotePriceBody }) =>
      csQuoteService.sendQuotePrice(jobId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      toast.success('Price sent to client for confirmation.');
    },
    onError: (err) => toastApiError(err),
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
