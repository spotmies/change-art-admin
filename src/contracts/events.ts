/**
 * WebSocket event type definitions — mirrored from the backend.
 *
 * Server emits, frontend consumes. The `SOCKET_EVENTS` map is the single
 * source of event-name strings on both sides — never inline a kebab-case
 * event string in a hook or component.
 *
 * Internal Node EventEmitter names from the backend are intentionally NOT
 * mirrored — the frontend has no direct visibility of internal pub/sub.
 */

import type { IsoDateTime } from './interfaces';
import type { JobStatus, ReviewDecision, ReviewType } from './enums';
import type { INotification } from './interfaces';

// ─── Server → Client events ──────────────────────────────────

export interface JobStatusChangedEvent {
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  handlerId: string | null;
  triggeredBy: string;
  timestamp: IsoDateTime;
}

/**
 * A brand-new job card was written. Fired in addition to any status event
 * so admin list views can prepend the row instantly and badge counts.
 */
export interface JobCreatedEvent {
  jobId: string;
  humanJobId: string;
  clientId: string;
  status: JobStatus;
  projectType: string;
  triggeredBy: string;
  triggeredByRole: string;
  timestamp: IsoDateTime;
}

export interface JobAssignedEvent {
  jobId: string;
  assignedTo: string;
  assignedBy: string;
  timestamp: IsoDateTime;
}

export interface ReviewSubmittedEvent {
  jobId: string;
  reviewType: ReviewType;
  decision: ReviewDecision;
  reviewerId: string;
  timestamp: IsoDateTime;
}

export interface NotificationNewEvent {
  notification: INotification;
}

export interface FileUploadCompleteEvent {
  jobId: string;
  fileId: string;
  fileName: string;
  uploadedBy: string;
}

export type QuoteUpdatedAction =
  | 'CREATED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTER_PROPOSED'
  | 'FINALIZED';

export interface QuoteUpdatedEvent {
  quoteId: string;
  jobId: string;
  action: QuoteUpdatedAction;
  timestamp: IsoDateTime;
}

export interface ModificationRequestedEvent {
  jobId: string;
  clientId: string;
  message: string | null;
  timestamp: IsoDateTime;
}

export type AttendanceClockAction = 'CLOCK_IN' | 'CLOCK_OUT';

export interface AttendanceClockEvent {
  userId: string;
  action: AttendanceClockAction;
  timestamp: IsoDateTime;
}

export interface JobAcknowledgedEvent {
  jobId: string;
  acknowledgedAt: IsoDateTime;
  etaHours: number | null;
}

export interface QueryRaisedEvent {
  jobId: string;
  queryId: string;
  raisedByRole: 'ADMIN' | 'CLIENT';
  message: string;
  timestamp: IsoDateTime;
}

// ─── Client → Server events ──────────────────────────────────

export interface JoinJobRoomEvent {
  jobId: string;
}

export interface LeaveJobRoomEvent {
  jobId: string;
}

export interface TypingIndicatorEvent {
  jobId: string;
  field: string;
}

// ─── Event name constants (single source of truth) ───────────

export const SOCKET_EVENTS = {
  JOB_STATUS_CHANGED: 'job-status-changed',
  JOB_CREATED: 'job-created',
  JOB_ASSIGNED: 'job-assigned',
  REVIEW_SUBMITTED: 'review-submitted',
  NOTIFICATION_NEW: 'notification-new',
  FILE_UPLOAD_COMPLETE: 'file-upload-complete',
  QUOTE_UPDATED: 'quote-updated',
  MODIFICATION_REQUESTED: 'modification-requested',
  ATTENDANCE_CLOCK: 'attendance-clock',
  JOB_ACKNOWLEDGED: 'job-acknowledged',
  QUERY_RAISED: 'query-raised',

  JOIN_JOB_ROOM: 'join-job-room',
  LEAVE_JOB_ROOM: 'leave-job-room',
  TYPING_INDICATOR: 'typing-indicator',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/**
 * Mapping from each server→client event name to its payload type.
 * Used to keep the SocketProvider's listener signatures honest.
 */
export interface ServerToClientEventMap {
  [SOCKET_EVENTS.JOB_STATUS_CHANGED]: JobStatusChangedEvent;
  [SOCKET_EVENTS.JOB_CREATED]: JobCreatedEvent;
  [SOCKET_EVENTS.JOB_ASSIGNED]: JobAssignedEvent;
  [SOCKET_EVENTS.REVIEW_SUBMITTED]: ReviewSubmittedEvent;
  [SOCKET_EVENTS.NOTIFICATION_NEW]: NotificationNewEvent;
  [SOCKET_EVENTS.FILE_UPLOAD_COMPLETE]: FileUploadCompleteEvent;
  [SOCKET_EVENTS.QUOTE_UPDATED]: QuoteUpdatedEvent;
  [SOCKET_EVENTS.MODIFICATION_REQUESTED]: ModificationRequestedEvent;
  [SOCKET_EVENTS.ATTENDANCE_CLOCK]: AttendanceClockEvent;
  [SOCKET_EVENTS.JOB_ACKNOWLEDGED]: JobAcknowledgedEvent;
}
