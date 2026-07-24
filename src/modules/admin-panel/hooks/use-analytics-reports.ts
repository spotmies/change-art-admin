import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function usePerformanceReport() {
  return useQuery({
    queryKey: ['analytics', 'reports', 'performance'],
    queryFn: () => analyticsService.performanceReport(),
    staleTime: 60_000,
  });
}

export function useMyPerformance() {
  return useQuery({
    queryKey: ['analytics', 'reports', 'performance', 'mine'],
    queryFn: () => analyticsService.myPerformance(),
    staleTime: 60_000,
  });
}

export function useQcRejectionReport() {
  return useQuery({
    queryKey: ['analytics', 'reports', 'qc-rejection'],
    queryFn: () => analyticsService.qcRejectionReport(),
    staleTime: 60_000,
  });
}
