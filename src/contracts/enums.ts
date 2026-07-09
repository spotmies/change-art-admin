/**
 * Shared enums — mirrored from change-art-backend/src/contracts/enums.ts.
 *
 * Single source of truth for all roles, statuses, and types.
 * Any new enum here MUST be added to the backend `src/contracts/enums.ts` and
 * to ARCHITECTURE_BLUEPRINT.md §0.4. The `api-contract-guard` subagent
 * audits this alignment.
 */

export enum UserRole {
  CLIENT = 'CLIENT',
  CS = 'CS',
  TEAM_LEAD = 'TEAM_LEAD',
  DESIGNER = 'DESIGNER',
  DIGITATOR = 'DIGITATOR',
  SEWOUT = 'SEWOUT',
  QC = 'QC',
  ADMIN = 'ADMIN',
}

export enum UserSubType {
  JUNIOR = 'JUNIOR',
  SENIOR = 'SENIOR',
}

export enum OrderType {
  ARTWORK = 'ARTWORK',
  DIGITIZING = 'DIGITIZING',
  DIGITIZING_SEWOUT = 'DIGITIZING_SEWOUT',
  OTHERS = 'OTHERS',
}

export enum ProjectType {
  LIVE = 'LIVE',
  AMEND = 'AMEND',
  QUOTE = 'QUOTE',
  LIVE_QUOTE = 'LIVE_QUOTE',
  CLIENT_RETURN = 'CLIENT_RETURN',
  VIRTUAL_LIVE = 'VIRTUAL_LIVE',
  VIRTUAL_AMEND = 'VIRTUAL_AMEND',
}

export enum DesignComplexity {
  SIMPLE = 'SIMPLE',
  MEDIUM = 'MEDIUM',
  SUPER_MEDIUM = 'SUPER_MEDIUM',
  COMPLEX = 'COMPLEX',
  SUPER_COMPLEX = 'SUPER_COMPLEX',
}

export enum ProcessType {
  SCREEN_PRINTING = 'SCREEN_PRINTING',
  OFFSET_PRINTING = 'OFFSET_PRINTING',
  DIGITAL_PRINTING = 'DIGITAL_PRINTING',
  OTHERS = 'OTHERS',
}

export enum Priority {
  NORMAL = 'NORMAL',
  RUSH = 'RUSH',
  SUPER_RUSH = 'SUPER_RUSH',
}

export enum Placement {
  CAP = 'CAP',
  FRONT_OF_CAP = 'FRONT_OF_CAP',
  BACK_OF_CAP = 'BACK_OF_CAP',
  SIDE_OF_CAP = 'SIDE_OF_CAP',
  VISOR = 'VISOR',
  BEANIE_CAP = 'BEANIE_CAP',
  TOWEL = 'TOWEL',
  BAGS = 'BAGS',
  LEFT_CHEST = 'LEFT_CHEST',
  SLEEVE = 'SLEEVE',
  POCKET = 'POCKET',
  FULL_BACK = 'FULL_BACK',
  FULL_FRONT = 'FULL_FRONT',
  BACK_YOKE = 'BACK_YOKE',
  OTHER = 'OTHER',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  QUOTE_SUBMITTED = 'QUOTE_SUBMITTED',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  JOB_PLACED = 'JOB_PLACED',
  CS_APPROVED = 'CS_APPROVED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED_TO_SENIOR = 'SUBMITTED_TO_SENIOR',
  SENIOR_REVIEW = 'SENIOR_REVIEW',
  SENIOR_REJECTED = 'SENIOR_REJECTED',
  SUBMITTED_TO_SEWOUT = 'SUBMITTED_TO_SEWOUT',
  SEWOUT_IN_PROGRESS = 'SEWOUT_IN_PROGRESS',
  SUBMITTED_TO_QC = 'SUBMITTED_TO_QC',
  QC_REVIEW = 'QC_REVIEW',
  QC_APPROVED = 'QC_APPROVED',
  QC_REJECTED = 'QC_REJECTED',
  READY_TO_DELIVER = 'READY_TO_DELIVER',
  DELIVERED = 'DELIVERED',
  MODIFICATION_REQUESTED = 'MODIFICATION_REQUESTED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  HOLD = 'HOLD',
}

export enum PaymentMode {
  CREDIT_CARD = 'CREDIT_CARD',
  CARD_ON_FILE = 'CARD_ON_FILE',
  ACH = 'ACH',
  PAYPAL = 'PAYPAL',
  CHECK = 'CHECK',
}

export enum QCRejectionReason {
  COLOUR = 'COLOUR',
  ALIGNMENT = 'ALIGNMENT',
  RESOLUTION = 'RESOLUTION',
  STITCH_ERROR = 'STITCH_ERROR',
  INCORRECT_BRIEF = 'INCORRECT_BRIEF',
  FILE_FORMAT = 'FILE_FORMAT',
  OTHER = 'OTHER',
}

export enum FinalFileFormat {
  PDF = 'PDF',
  EPS = 'EPS',
  AI = 'AI',
  CDR = 'CDR',
  OTHERS = 'OTHERS',
}

export enum LeaveType {
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  EARNED = 'EARNED',
  UNPAID = 'UNPAID',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT_TO_CLIENT = 'SENT_TO_CLIENT',
  CLIENT_ACCEPTED = 'CLIENT_ACCEPTED',
  CLIENT_REJECTED = 'CLIENT_REJECTED',
  COUNTER_PROPOSED = 'COUNTER_PROPOSED',
  FINALIZED = 'FINALIZED',
}

export enum NotificationType {
  JOB_STATUS_CHANGE = 'JOB_STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  REVIEW_FEEDBACK = 'REVIEW_FEEDBACK',
  QC_DECISION = 'QC_DECISION',
  MODIFICATION_REQUEST = 'MODIFICATION_REQUEST',
  QUOTE_UPDATE = 'QUOTE_UPDATE',
  DELIVERY = 'DELIVERY',
  SYSTEM = 'SYSTEM',
  CLIENT_DATA_ACCESSED = 'CLIENT_DATA_ACCESSED',
  QUERY = 'QUERY',
}

export enum FileCategory {
  ORIGINAL = 'ORIGINAL',
  COMPLETED = 'COMPLETED',
}

export enum FileScanStatus {
  PENDING = 'PENDING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  SCAN_FAILED = 'SCAN_FAILED',
}

export enum ReviewType {
  SENIOR_REVIEW = 'SENIOR_REVIEW',
  QC_REVIEW = 'QC_REVIEW',
}

export enum ReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum QuoteAction {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COUNTER_PROPOSED = 'COUNTER_PROPOSED',
}

export enum EmailIngestionStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  IGNORED = 'IGNORED',
}

/** Approval lifecycle for self-registered clients. Null = manually created by admin/CS. */
export enum ClientApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ─── FE-only enums (not in backend; UI-presentation concerns) ───

export enum Theme {
  DARK = 'dark',
  LIGHT = 'light',
}

export enum ToastVariant {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
}
