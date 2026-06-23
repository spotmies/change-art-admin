import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@lib/query-keys';
import { adminService } from '../services/admin.service';
import { useUnreadCount } from '@modules/notifications/hooks/use-notifications';

// per_page: 1 — we only need meta.total for the sidebar badge count.
// Fetching 100 full records just to read a number is wasteful; 1 is enough.
// Note: this uses a different query key from useProfileChangeRequests(filters)
// on the Clients page, so they do not share cache and won't conflict.
const PENDING_CR_FILTERS = { status: 'PENDING' as const, per_page: 1 };

/**
 * Returns a map of nav-item-id → badge count for the admin sidebar.
 *
 * Uses the same query key as useAdminJobCards() (no extra filters) so it
 * shares the in-memory cache with any page that fetched job-cards with
 * default params. Pass `enabled = false` for non-admin roles.
 */
export function useAdminNavBadges(enabled: boolean): Record<string, number> {
  const { data } = useQuery({
    queryKey: queryKeys.jobs.badges(),
    queryFn: () => adminService.getJobBadges(),
    staleTime: 30 * 1000,
    enabled,
  });

  // Shares its cache key with the Profile Requests tab on the Clients page
  // so opening that tab is a cache hit.
  const { data: pendingChangeRequests } = useQuery({
    queryKey: queryKeys.clients.changeRequests(PENDING_CR_FILTERS),
    queryFn: () => adminService.listProfileChangeRequests(PENDING_CR_FILTERS),
    staleTime: 30 * 1000,
    enabled,
  });

  // Shares the same cache entry as the bell icon in the topbar so no extra
  // network request is made — both components read from the same query key.
  const { data: unreadData } = useUnreadCount(enabled);

  return useMemo(() => {
    const badges: Record<string, number> = {};
    if (data) {
      badges['new-quotes'] = data['new-quotes'] ?? 0;
      badges['new-jobs'] = data['new-jobs'] ?? 0;
    }
    if (pendingChangeRequests) {
      badges['clients'] = pendingChangeRequests.meta.total;
    }
    if (unreadData) {
      badges['notifications'] = unreadData.count;
    }
    return badges;
  }, [data, pendingChangeRequests, unreadData]);
}
