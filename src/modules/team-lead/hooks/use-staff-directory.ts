import { useQuery } from '@tanstack/react-query';
import { staffDirectoryService } from '../services/staff-directory.service';

export function useStaffDirectory(role?: 'DESIGNER' | 'DIGITATOR' | 'SEWOUT') {
  return useQuery({
    queryKey: ['staff-directory', role ?? 'all'],
    queryFn: () => staffDirectoryService.list(role),
    refetchInterval: 30_000,
  });
}
