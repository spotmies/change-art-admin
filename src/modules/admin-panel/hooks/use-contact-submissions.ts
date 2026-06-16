import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@lib/query-keys';
import { adminService } from '../services/admin.service';

export function useContactSubmissions() {
  return useQuery({
    queryKey: queryKeys.contactSubmissions.list(),
    queryFn: () => adminService.listContactSubmissions(),
    staleTime: 30_000,
  });
}

export function useContactSubmission(id: string | null) {
  return useQuery({
    queryKey: queryKeys.contactSubmissions.byId(id ?? ''),
    queryFn: () => adminService.getContactSubmission(id!),
    enabled: !!id,
  });
}
