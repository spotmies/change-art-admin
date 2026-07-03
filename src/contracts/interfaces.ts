/**
 * Shared entity interfaces — mirrored from the backend's contracts layer.
 *
 * The wire format: what the API sends as JSON and the frontend consumes.
 * Note: server-side fields use `Date` objects in Node; over the wire these
 * arrive as ISO 8601 strings. The FE keeps them as `string` and converts
 * to `Date` at the boundary (TanStack Query `select` or component-level
 * date-fns parse).
 *
 * Any new interface added here MUST be reflected in the backend and in
 * ARCHITECTURE_BLUEPRINT.md §0.4. The `api-contract-guard` subagent audits
 * this alignment.
 */

import type {
  ClientApprovalStatus,
  DesignComplexity,
  EmailIngestionStatus,
  FileCategory,
  FileScanStatus,
  FinalFileFormat,
  JobStatus,
  LeaveStatus,
  LeaveType,
  NotificationType,
  OrderType,
  PaymentMode,
  Placement,
  Priority,
  ProcessType,
  ProjectType,
  QCRejectionReason,
  QuoteAction,
  QuoteStatus,
  ReviewDecision,
  ReviewType,
  UserRole,
  UserSubType,
} from './enums';

/** ISO 8601 timestamp string. */
export type IsoDateTime = string;

/** YYYY-MM-DD calendar date string. */
export type IsoDate = string;

/** Numeric string (Postgres decimal serialised as JSON string for precision). */
export type DecimalString = string;

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: IsoDateTime;
}

export interface IUser {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  sub_type: UserSubType | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface IClient {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name: string;
  company_name: string | null;
  contact_name: string;
  contact_number: string;
  email: string;
  date: IsoDateTime;
  location: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  payment_mode: PaymentMode | null;
  card_on_file: ICardOnFile | null;
  user_id: string | null;
  approval_status: ClientApprovalStatus | null;
  /** Admin's stated reason when approval_status = REJECTED. Null otherwise. */
  rejection_note: string | null;
  /** Admin-set restriction: blocks new quote/order submissions while true. */
  is_hotlisted: boolean;
  hotlisted_at: IsoDateTime | null;
  hotlisted_by: string | null;
  /** Admin-controlled account status. When false the client cannot log in or use the portal. */
  is_active: boolean;
  deactivated_at: IsoDateTime | null;
  deactivated_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * Non-sensitive card metadata persisted alongside a client when payment_mode
 * is CARD. The actual processor token is stored server-side and never exposed
 * to the admin panel.
 */
export interface ICardOnFile {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

/**
 * Client's own view of their record — sensitive fields stripped server-side.
 * Returned from GET /api/v1/clients/me.
 */
export interface IClientSelfView {
  id: string;
  client_id: string;
  client_name: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  date: IsoDateTime;
  location: string | null;
}

export interface IJobCard {
  id: string;
  tenant_id: string;
  job_id: string;
  reference_number: string;
  client_id: string;
  mail: string;
  time_and_date: IsoDateTime;
  order_type: OrderType;
  project_type: ProjectType;
  eta_hours: number | null;
  design_name: string;
  design_complexity: DesignComplexity | null;
  process_type: ProcessType | null;
  priority: Priority;
  final_files: FinalFileFormat[];
  notes: string | null;
  placement: Placement | null;
  width_inches: number | null;
  height_inches: number | null;
  num_colors: number | null;
  fabric: string | null;
  payment: string | null;
  mail_description: string | null;
  sewout_required: boolean | null;
  description: string | null;
  specific_type: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  client_po: string | null;
  stitch_count: number | null;
  /** Flat price the agency quoted to the client (set via /cs/jobs/:id/quote/send-price). */
  admin_price: number | null;
  admin_price_currency: string | null;
  /** Optional note the agency included with the price. */
  admin_price_note: string | null;
  status: JobStatus;
  current_handler_id: string | null;
  assigned_junior_id: string | null;
  assigned_senior_id: string | null;
  assigned_sewout_id: string | null;
  modification_count: number;
  version: number;
  is_locked: boolean;
  acknowledgement_sent_at: IsoDateTime | null;
  is_admin_copy: boolean;
  parent_job_id: string | null;
  has_admin_copy: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** Embedded client snapshot — populated by list/findById queries via LEFT JOIN. */
  client_info?: { client_id: string; client_name: string; company_name: string | null } | null;
  /** Notes from the latest client modification request — populated when status is MODIFICATION_REQUESTED. */
  modification_notes?: string | null;
}

export interface IFileVersion {
  id: string;
  tenant_id: string;
  job_card_id: string;
  file_category: FileCategory;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_key?: string;
  storage_url?: string;
  version_number: number;
  uploaded_by: string;
  scan_status: FileScanStatus;
  created_at: IsoDateTime;
}

export interface IReview {
  id: string;
  tenant_id: string;
  job_card_id: string;
  reviewer_id: string;
  review_type: ReviewType;
  decision: ReviewDecision;
  rejection_reason: QCRejectionReason | null;
  feedback: string | null;
  reference_file_ids: string[];
  created_at: IsoDateTime;
}

export interface IWorkflowTransition {
  id: string;
  tenant_id: string;
  job_card_id: string;
  from_status: JobStatus;
  to_status: JobStatus;
  triggered_by: string;
  handler_id: string | null;
  notes: string | null;
  created_at: IsoDateTime;
}

export interface IAssignment {
  id: string;
  tenant_id: string;
  job_card_id: string;
  assigned_to: string;
  assigned_by: string;
  role_at_assignment: UserRole;
  sub_type_at_assignment: UserSubType | null;
  deadline: IsoDateTime | null;
  notes: string | null;
  is_active: boolean;
  created_at: IsoDateTime;
}

export interface IQuote {
  id: string;
  tenant_id: string;
  job_card_id: string;
  status: QuoteStatus;
  total_amount: DecimalString;
  currency: string;
  created_by: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface IQuoteLineItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: DecimalString;
  total: DecimalString;
}

export interface IQuoteNegotiation {
  id: string;
  quote_id: string;
  actor_id: string;
  actor_role: UserRole;
  action: QuoteAction;
  proposed_amount: DecimalString | null;
  message: string | null;
  created_at: IsoDateTime;
}

export interface INotification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: IsoDateTime;
}

export interface IFcmToken {
  id: string;
  user_id: string;
  token: string;
  device_info: string | null;
  created_at: IsoDateTime;
}

export interface IJobQuery {
  id: string;
  tenant_id: string;
  job_card_id: string;
  raised_by_user_id: string;
  raised_by_role: 'ADMIN' | 'CLIENT';
  message: string;
  is_resolved: boolean;
  created_at: IsoDateTime;
  raised_by_name?: string;
}

export interface IAttendanceRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  clock_in: IsoDateTime;
  clock_out: IsoDateTime | null;
  total_hours: DecimalString | null;
  date: IsoDate;
  notes: string | null;
  created_at: IsoDateTime;
}

export interface ILeaveRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: IsoDate;
  end_date: IsoDate;
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface IContactSubmissionAttachment {
  filename: string;
  mimeType: string;
  size: string;
  storageKey: string;
  type: 'image' | 'pdf' | 'other';
  url?: string;
}

export interface IContactSubmissionAiData {
  intent?: string;
  confidence?: number;
  rejection_reason?: string;
  design_name?: string;
  order_type?: string;
  priority?: string;
  notes?: string;
  width_inches?: number;
  height_inches?: number;
  num_colors?: number;
  contact_name?: string;
  contact_number?: string;
}

export interface IIngestedEmail {
  id: string;
  tenant_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  attachments: IContactSubmissionAttachment[];
  created_at: IsoDateTime;
  ai_status: EmailIngestionStatus;
  ai_intent: string | null;
  ai_confidence: string | null;
  ai_extracted_data: IContactSubmissionAiData | null;
  linked_job_card_id: string | null;
}

// ─── API Envelope Types ──────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp: IsoDateTime;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    stack?: string;
  };
  timestamp: IsoDateTime;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginationQuery {
  page?: number;
  per_page?: number;
}

/** Standard pagination wrapper returned by `*-list` endpoints. */
export interface PaginatedList<T> {
  items: T[];
  meta: PaginationMeta;
}

// ─── Auth Session Shape (from Better Auth) ───────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sub_type: UserSubType | null;
  tenant_id: string;
  is_active: boolean;
}

export interface SessionResponse {
  user: SessionUser | null;
}
