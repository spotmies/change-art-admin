import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmailIngestionStatus } from '@contracts';
import { queryKeys } from '@lib/query-keys';
import { adminService } from '../services/admin.service';
import { useUnreadCount } from '@modules/notifications/hooks/use-notifications';
import { useAdminJobViews } from './use-admin-jobs';
import { isJobEtaExpired } from '@lib/utils';
import { IN_PRODUCTION_STATUSES } from '@modules/shared-ui';

/**
 * Shared across both nav-badge hooks — the Email Inbox badge counts emails
 * still awaiting triage (PENDING), not the notification bell's unread count.
 * Those are unrelated queues: "mark all read" on notifications must not
 * touch this number, and this number must not double as a notification count.
 */
export function usePendingEmailCount(enabled: boolean): number | undefined {
  const { data } = useQuery({
    queryKey: queryKeys.contactSubmissions.list(),
    queryFn: () => adminService.listContactSubmissions(),
    staleTime: 30 * 1000,
    enabled,
  });
  return data?.filter((e) => e.ai_status === EmailIngestionStatus.PENDING).length;
}

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

  const { jobs } = useAdminJobViews(enabled ? { per_page: 200 } : { per_page: 1 });

  // Shares its cache key with the Profile Requests tab on the Clients page
  // so opening that tab is a cache hit.
  const { data: pendingChangeRequests } = useQuery({
    queryKey: queryKeys.clients.changeRequests(PENDING_CR_FILTERS),
    queryFn: () => adminService.listProfileChangeRequests(PENDING_CR_FILTERS),
    staleTime: 30 * 1000,
    enabled,
  });

  // Shares its cache key with the Sign Up Requests tab on the Clients page.
  // The "clients" badge needs BOTH counts — a pending signup is just as
  // actionable as a pending profile-change request, and counting only the
  // latter silently hid new signups from the sidebar.
  const { data: pendingSignups } = useQuery({
    queryKey: queryKeys.clients.pending(),
    queryFn: () => adminService.getPendingClients(),
    staleTime: 30 * 1000,
    enabled,
  });

  // Shares the same cache entry as the bell icon in the topbar so no extra
  // network request is made — both components read from the same query key.
  const { data: unreadData } = useUnreadCount(enabled);

  const pendingEmailCount = usePendingEmailCount(enabled);

  return useMemo(() => {
    const badges: Record<string, number> = {};
    if (data) {
      badges['new-quotes'] = data['new-quotes'] ?? 0;
      badges['new-jobs'] = data['new-jobs'] ?? 0;
      if ((data['amendments'] ?? 0) > 0) badges['amendments'] = data['amendments'] ?? 0;
      badges['live'] = data['live'] ?? 0;
      badges['live-quote'] = data['live-quote'] ?? 0;
      badges['in-production'] = data['in-production'] ?? 0;
      badges['deliver'] = data['deliver'] ?? 0;
    }

    if (jobs && jobs.length > 0) {
      const readyCount = jobs.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)).length;
      if (readyCount > 0) {
        badges['deliver'] = Math.max(badges['deliver'] ?? 0, readyCount);
      }
      const activeProdCount = jobs.filter((j) => IN_PRODUCTION_STATUSES.includes(j.status) && !isJobEtaExpired(j)).length;
      if (activeProdCount >= 0 && data) {
        badges['in-production'] = activeProdCount;
      }
    }

    if (pendingChangeRequests || pendingSignups) {
      badges['clients'] = (pendingChangeRequests?.meta.total ?? 0) + (pendingSignups?.length ?? 0);
    }
    if (unreadData) {
      badges['notifications'] = unreadData.count;
    }
    if (pendingEmailCount !== undefined) {
      badges['email-inbox'] = pendingEmailCount;
    }
    return badges;
  }, [data, jobs, pendingChangeRequests, pendingSignups, unreadData, pendingEmailCount]);
}

/**
 * Returns a map of nav-item-id → badge count for the CS sidebar (New
 * Requests / Live / Live Quote / Quote / Amend / In Production / Ready to
 * Dispatch / Email Inbox). Pass `enabled = false` for non-CS roles.
 */
export function useCsNavBadges(enabled: boolean): Record<string, number> {
  const adminBadges = useAdminNavBadges(enabled);
  return useMemo(() => {
    return {
      ...adminBadges,
      quote: adminBadges['new-quotes'] ?? 0,
      amend: adminBadges['amendments'] ?? 0,
    };
  }, [adminBadges]);
}
