/**
 * Error code constants — mirrored from the backend.
 *
 * Every catch block that handles an API error MUST reference one of these
 * codes (never string-match on `error.message`). The `api-contract-guard`
 * subagent audits this rule.
 */

export const ERROR_CODES = {
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Auth
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOO_MANY_OTP_ATTEMPTS: 'TOO_MANY_OTP_ATTEMPTS',

  // Authorization
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  FORBIDDEN_FIELD: 'FORBIDDEN_FIELD',

  // Job Card / Workflow
  JOB_CARD_NOT_FOUND: 'JOB_CARD_NOT_FOUND',
  JOB_CARD_LOCKED: 'JOB_CARD_LOCKED',
  JOB_CARD_VERSION_MISMATCH: 'JOB_CARD_VERSION_MISMATCH',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  WORKFLOW_RULE_VIOLATION: 'WORKFLOW_RULE_VIOLATION',

  // Assignments / Reviews
  USER_NOT_ASSIGNABLE: 'USER_NOT_ASSIGNABLE',
  ALREADY_ASSIGNED: 'ALREADY_ASSIGNED',
  REVIEW_FEEDBACK_REQUIRED: 'REVIEW_FEEDBACK_REQUIRED',
  STITCH_COUNT_REQUIRED: 'STITCH_COUNT_REQUIRED',

  // Files
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  FILE_SCAN_FAILED: 'FILE_SCAN_FAILED',
  FILE_INFECTED: 'FILE_INFECTED',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Clients
  CLIENT_HAS_JOBS: 'CLIENT_HAS_JOBS',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_ID_TAKEN: 'CLIENT_ID_TAKEN',

  // Quotes
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  QUOTE_FINALIZED: 'QUOTE_FINALIZED',
  QUOTE_INVALID_ACTION: 'QUOTE_INVALID_ACTION',

  // Payment & Dispatch
  CARD_VALIDATION_FAILED: 'CARD_VALIDATION_FAILED',
  CARD_PROCESSOR_ERROR: 'CARD_PROCESSOR_ERROR',
  PAYMENT_METHOD_UNAVAILABLE: 'PAYMENT_METHOD_UNAVAILABLE',
  JOB_NOT_READY_FOR_DISPATCH: 'JOB_NOT_READY_FOR_DISPATCH',
  NO_DELIVERABLE_FILES: 'NO_DELIVERABLE_FILES',
  JOB_ALREADY_DISPATCHED: 'JOB_ALREADY_DISPATCHED',
  JOB_CANNOT_ACKNOWLEDGE: 'JOB_CANNOT_ACKNOWLEDGE',
  JOB_ALREADY_ACKNOWLEDGED: 'JOB_ALREADY_ACKNOWLEDGED',

  // Attendance
  ALREADY_CLOCKED_IN: 'ALREADY_CLOCKED_IN',
  NOT_CLOCKED_IN: 'NOT_CLOCKED_IN',
  LEAVE_DATE_RANGE_INVALID: 'LEAVE_DATE_RANGE_INVALID',

  // Email Ingestion
  INGESTION_DISABLED: 'INGESTION_DISABLED',
  INGESTION_PARSE_ERROR: 'INGESTION_PARSE_ERROR',

  // FE-only convenience codes (used for client-side rejected requests)
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Default human-readable message per error code. Components may override
 * with a contextual message; this is the fallback toast copy.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  NOT_FOUND: 'We could not find what you were looking for.',
  CONFLICT: 'This record was updated by someone else. Please refresh and retry.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',

  UNAUTHENTICATED: 'Please sign in to continue.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  ACCOUNT_DEACTIVATED: 'This account has been deactivated.',
  INVALID_OTP: 'Incorrect code. Please try again.',
  OTP_EXPIRED: 'This code has expired. Please request a new one.',
  TOO_MANY_OTP_ATTEMPTS: 'Too many incorrect attempts. Please request a new code.',

  INSUFFICIENT_PERMISSIONS: "You don't have permission to do this.",
  TENANT_MISMATCH: 'You cannot access records from another organisation.',
  FORBIDDEN_FIELD: 'You cannot modify this field.',

  JOB_CARD_NOT_FOUND: 'This job card was not found.',
  JOB_CARD_LOCKED: 'This job is locked after QC approval and cannot be changed.',
  JOB_CARD_VERSION_MISMATCH: 'This job was updated elsewhere. Please refresh and retry.',
  INVALID_TRANSITION: 'This status change is not allowed from the current state.',
  WORKFLOW_RULE_VIOLATION: 'This action is not allowed in the current workflow stage.',

  USER_NOT_ASSIGNABLE: 'This user cannot take this job — wrong role or sub-type.',
  ALREADY_ASSIGNED: 'This job is already assigned.',
  REVIEW_FEEDBACK_REQUIRED: 'Please add a feedback note before rejecting.',
  STITCH_COUNT_REQUIRED: 'Stitch count is required before submitting to QC.',

  FILE_TOO_LARGE: 'This file is larger than the upload limit.',
  FILE_TYPE_NOT_ALLOWED: 'This file type is not supported.',
  FILE_SCAN_FAILED: 'Virus scan failed for this file. Please try again.',
  FILE_INFECTED: 'This file failed the virus scan and cannot be used.',
  STORAGE_ERROR: 'The file storage service is temporarily unavailable.',

  CLIENT_HAS_JOBS: 'This client has active jobs and cannot be deleted.',
  CLIENT_NOT_FOUND: 'This client was not found.',
  CLIENT_ID_TAKEN: 'A client with this ID already exists.',

  QUOTE_NOT_FOUND: 'This quote was not found.',
  QUOTE_FINALIZED: 'This quote is final and cannot be changed.',
  QUOTE_INVALID_ACTION: 'This quote action is not allowed right now.',

  CARD_VALIDATION_FAILED: "We couldn't validate that card.",
  CARD_PROCESSOR_ERROR: 'Bank declined this card.',
  PAYMENT_METHOD_UNAVAILABLE: 'Card updates temporarily unavailable.',
  JOB_NOT_READY_FOR_DISPATCH: 'This job is not in QC yet.',
  NO_DELIVERABLE_FILES: 'Upload at least one completed file before dispatching.',
  JOB_ALREADY_DISPATCHED: 'This job was already delivered.',
  JOB_CANNOT_ACKNOWLEDGE: 'This job cannot be acknowledged in its current state.',
  JOB_ALREADY_ACKNOWLEDGED: 'This job has already been acknowledged.',

  ALREADY_CLOCKED_IN: "You're already clocked in.",
  NOT_CLOCKED_IN: 'You are not clocked in.',
  LEAVE_DATE_RANGE_INVALID: 'Please pick a valid date range for your leave.',

  INGESTION_DISABLED: 'Email ingestion is disabled.',
  INGESTION_PARSE_ERROR: 'We could not read the incoming email.',

  NETWORK_ERROR: 'Network unavailable. Check your connection and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};
