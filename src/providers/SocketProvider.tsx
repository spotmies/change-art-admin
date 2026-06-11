import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  SOCKET_EVENTS,
  type JobAcknowledgedEvent,
  type JobAssignedEvent,
  type JobCreatedEvent,
  type JobStatusChangedEvent,
  type NotificationNewEvent,
  type FileUploadCompleteEvent,
  type QuoteUpdatedEvent,
  type ReviewSubmittedEvent,
  type ModificationRequestedEvent,
  type AttendanceClockEvent,
} from '@contracts';
import { useIsAuthenticated, useSessionUser } from '@modules/auth/stores/auth-store';
import { connectSocket, disconnectSocket, ensureSocketConnected } from '@lib/socket-client';
import { queryKeys } from '@lib/query-keys';

interface SocketProviderProps {
  children: ReactNode;
}

/**
 * Connects the Socket.IO client once we know the user is authenticated, and
 * routes every server-to-client event into the appropriate TanStack Query
 * invalidation. The socket disconnects on sign-out so the next user does
 * not inherit stale subscriptions.
 *
 * All event names are imported from `@contracts/events.SOCKET_EVENTS` —
 * never inline a string.
 */
export function SocketProvider({ children }: SocketProviderProps) {
  const isAuthenticated = useIsAuthenticated();
  const user = useSessionUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    socket.on(SOCKET_EVENTS.JOB_STATUS_CHANGED, (event: JobStatusChangedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.timeline(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    });

    // New job card was just written. Refresh every list view that filters
    // by status so the row appears at the top without waiting for the
    // 30-second background refetch.
    socket.on(SOCKET_EVENTS.JOB_CREATED, (event: JobCreatedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      // Client-submitted jobs get a glanceable toast so a CS rep watching
      // any tab knows a new quote/job came in even before they look at the
      // queue. Internal-created jobs (admin/CS) skip the toast — the
      // creator is the one who just saw the success toast.
      if (event.triggeredByRole === 'CLIENT') {
        const isQuote = event.projectType === 'QUOTE' || event.projectType === 'LIVE_QUOTE';
        toast.success(
          isQuote
            ? `New quote request • ${event.humanJobId}`
            : `New job submitted • ${event.humanJobId}`,
          { id: `job-created-${event.jobId}`, icon: '📥', duration: 5000 },
        );
      }
    });

    socket.on(SOCKET_EVENTS.JOB_ASSIGNED, (event: JobAssignedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    });

    socket.on(SOCKET_EVENTS.REVIEW_SUBMITTED, (event: ReviewSubmittedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forJob(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, (event: NotificationNewEvent) => {
      const n = event.notification;

      // 1. Optimistically bump the bell badge in cache so it updates the
      //    moment the event arrives — independent of any network refetch.
      //    Only counts toward unread if the row is actually unread (which
      //    every freshly delivered notification is, by definition).
      if (n.is_read === false || n.is_read === undefined) {
        queryClient.setQueryData<{ count: number }>(
          queryKeys.notifications.unreadCount(),
          (old) => ({ count: (old?.count ?? 0) + 1 }),
        );
      }

      // 2. Invalidate ONLY the notification list (the open panel), not the
      //    unread-count query — step 1 already moved the badge optimistically,
      //    so re-fetching the count here would be a redundant network call
      //    (one per event) that just races with the value we just set.
      //    The list query is only enabled while the bell panel is open, so
      //    this is a no-op network-wise when the panel is closed.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(),
      });

      // 3. Toast — two-line with title + body, line-wrap enabled.
      toast(
        n.body ? `${n.title}\n${n.body}` : n.title,
        {
          id: `notif-${n.id}`,
          icon: '🔔',
          duration: 5500,
          style: { whiteSpace: 'pre-line', maxWidth: 380 },
        },
      );
    });

    socket.on(SOCKET_EVENTS.FILE_UPLOAD_COMPLETE, (event: FileUploadCompleteEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files.forJob(event.jobId) });
    });

    socket.on(SOCKET_EVENTS.QUOTE_UPDATED, (event: QuoteUpdatedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.byId(event.quoteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.negotiations(event.quoteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    });

    socket.on(SOCKET_EVENTS.MODIFICATION_REQUESTED, (event: ModificationRequestedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    });

    // Attendance — fired when anyone in the tenant clocks in/out. Refresh the
    // current day's roster + the active user's history so admin dashboards
    // ("Who's clocked in right now?") stay correct without polling.
    socket.on(SOCKET_EVENTS.ATTENDANCE_CLOCK, (_event: AttendanceClockEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.history() });
    });

    socket.on(SOCKET_EVENTS.JOB_ACKNOWLEDGED, (event: JobAcknowledgedEvent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(event.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    });

    // Re-attach on tab focus — Chrome/Safari sometimes background-throttle the
    // socket and the auto-reconnect may have given up. This is idempotent.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') ensureSocketConnected();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Remove ONLY the listeners this provider registered. We don't call
      // `removeAllListeners()` (that would also strip Socket.IO's internal
      // book-keeping listeners) and we don't `disconnectSocket()` here —
      // StrictMode double-mounts this effect in dev, so disconnecting +
      // reconnecting on every cleanup is exactly what produced two SIDs in
      // the console and duplicate toasts per event. The socket lifecycle is
      // governed by the auth gate above: when `isAuthenticated` flips to
      // false, that branch calls `disconnectSocket()`.
      socket.off(SOCKET_EVENTS.JOB_STATUS_CHANGED);
      socket.off(SOCKET_EVENTS.JOB_CREATED);
      socket.off(SOCKET_EVENTS.JOB_ASSIGNED);
      socket.off(SOCKET_EVENTS.REVIEW_SUBMITTED);
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW);
      socket.off(SOCKET_EVENTS.FILE_UPLOAD_COMPLETE);
      socket.off(SOCKET_EVENTS.QUOTE_UPDATED);
      socket.off(SOCKET_EVENTS.MODIFICATION_REQUESTED);
      socket.off(SOCKET_EVENTS.ATTENDANCE_CLOCK);
      socket.off(SOCKET_EVENTS.JOB_ACKNOWLEDGED);
    };
  }, [isAuthenticated, user, queryClient]);

  return <>{children}</>;
}
