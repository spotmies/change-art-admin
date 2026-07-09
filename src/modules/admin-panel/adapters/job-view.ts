import {
  DesignComplexity,
  JobStatus,
  OrderType,
  Placement,
  Priority,
  ProcessType,
  ProjectType,
} from '@contracts';
import type { IJobCard } from '@contracts';
import type {
  Job,
  JobComplexity,
  JobOrderType,
  JobPriority,
  JobProject,
  JobStage,
  JobStatus as JobStatusDisplay,
} from '@modules/shared-ui';
import { normalizeRefNumber } from '@lib/utils';
import { resolveClientCardExpiry } from '@lib/card-expiry';

const ORDER_DISPLAY: Record<OrderType, JobOrderType> = {
  [OrderType.ARTWORK]: 'Artwork',
  [OrderType.DIGITIZING]: 'Digitizing',
  [OrderType.DIGITIZING_SEWOUT]: 'Digitizing + Sewout',
  [OrderType.OTHERS]: 'Other',
};

const PROJECT_DISPLAY: Record<ProjectType, JobProject> = {
  [ProjectType.LIVE]: 'Live',
  [ProjectType.QUOTE]: 'Quote',
  [ProjectType.AMEND]: 'Amend',
  [ProjectType.LIVE_QUOTE]: 'Live Quote',
  [ProjectType.CLIENT_RETURN]: 'Amend',
  [ProjectType.VIRTUAL_LIVE]: 'Live',
  [ProjectType.VIRTUAL_AMEND]: 'Amend',
};

const COMPLEXITY_DISPLAY: Record<DesignComplexity, JobComplexity> = {
  [DesignComplexity.SIMPLE]: 'Simple',
  [DesignComplexity.MEDIUM]: 'Medium',
  [DesignComplexity.SUPER_MEDIUM]: 'Super Medium',
  [DesignComplexity.COMPLEX]: 'Complex',
  [DesignComplexity.SUPER_COMPLEX]: 'Super Complex',
};

const PRIORITY_DISPLAY: Record<Priority, JobPriority> = {
  [Priority.NORMAL]: 'Normal',
  [Priority.RUSH]: 'Rush',
  [Priority.SUPER_RUSH]: 'Super Rush',
};

const PROCESS_DISPLAY: Record<ProcessType, string> = {
  [ProcessType.SCREEN_PRINTING]: 'Screen Printing',
  [ProcessType.OFFSET_PRINTING]: 'Offset Printing',
  [ProcessType.DIGITAL_PRINTING]: 'Digital Printing',
  [ProcessType.OTHERS]: 'Other',
};

const PLACEMENT_DISPLAY: Record<Placement, string> = {
  [Placement.CAP]: 'Cap',
  [Placement.FRONT_OF_CAP]: 'Front of Cap',
  [Placement.BACK_OF_CAP]: 'Back of Cap',
  [Placement.SIDE_OF_CAP]: 'Side of Cap',
  [Placement.VISOR]: 'Visor',
  [Placement.BEANIE_CAP]: 'Beanie Cap',
  [Placement.TOWEL]: 'Towel',
  [Placement.BAGS]: 'Bags',
  [Placement.LEFT_CHEST]: 'Left Chest',
  [Placement.SLEEVE]: 'Sleeve',
  [Placement.POCKET]: 'Pocket',
  [Placement.FULL_BACK]: 'Full Back',
  [Placement.FULL_FRONT]: 'Full Front',
  [Placement.BACK_YOKE]: 'Back Yoke',
  [Placement.OTHER]: 'Other',
};

type StageDisplay = { status: JobStatusDisplay; stage: JobStage };

const STATUS_MAP: Record<JobStatus, StageDisplay> = {
  [JobStatus.DRAFT]: { status: 'In Review', stage: 'quote' },
  [JobStatus.QUOTE_SUBMITTED]: { status: 'Quote Submitted', stage: 'quote' },
  [JobStatus.QUOTE_APPROVED]: { status: 'Quote Approved', stage: 'quote' },
  [JobStatus.QUOTE_REJECTED]: { status: 'Cancelled', stage: 'quote' },
  [JobStatus.JOB_PLACED]: { status: 'In Production', stage: 'junior' },
  [JobStatus.CS_APPROVED]: { status: 'In Production', stage: 'junior' },
  [JobStatus.ASSIGNED]: { status: 'In Production', stage: 'junior' },
  [JobStatus.IN_PROGRESS]: { status: 'In Production', stage: 'junior' },
  [JobStatus.SUBMITTED_TO_SENIOR]: { status: 'Senior Review', stage: 'senior' },
  [JobStatus.SENIOR_REVIEW]: { status: 'Senior Review', stage: 'senior' },
  [JobStatus.SENIOR_REJECTED]: { status: 'In Production', stage: 'junior' },
  [JobStatus.SUBMITTED_TO_SEWOUT]: { status: 'Sewout', stage: 'sewout' },
  [JobStatus.SEWOUT_IN_PROGRESS]: { status: 'Sewout', stage: 'sewout' },
  [JobStatus.SUBMITTED_TO_QC]: { status: 'In QC', stage: 'qc' },
  [JobStatus.QC_REVIEW]: { status: 'In QC', stage: 'qc' },
  [JobStatus.QC_APPROVED]: { status: 'Ready to Deliver', stage: 'delivered' },
  [JobStatus.QC_REJECTED]: { status: 'In Production', stage: 'junior' },
  [JobStatus.READY_TO_DELIVER]: { status: 'Ready to Deliver', stage: 'delivered' },
  [JobStatus.DELIVERED]: { status: 'Dispatched', stage: 'delivered' },
  [JobStatus.MODIFICATION_REQUESTED]: { status: 'Amend', stage: 'qc' },
  [JobStatus.CLOSED]: { status: 'Dispatched', stage: 'delivered' },
  [JobStatus.CANCELLED]: { status: 'Cancelled', stage: 'quote' },
  // Fallback only — adaptJobCard overrides `stage` using pre_hold_status so
  // a held job stays in its original kanban column instead of jumping here.
  [JobStatus.HOLD]: { status: 'On Hold', stage: 'junior' },
};

export interface ClientInfo {
  name: string;
  clientId: string;
}

export function adaptJobCard(
  card: IJobCard,
  clientsMap: Map<string, ClientInfo>,
  usersMap: Map<string, string>,
): Job {
  const mapped = STATUS_MAP[card.status] ?? { status: 'In Review' as JobStatusDisplay, stage: 'junior' as JobStage };

  // JOB_PLACED means CS created the job but the TL hasn't acknowledged it yet.
  // Only flip to "In Production" once the ack has been sent; before that show
  // "Pending" so staff can see the job still needs acknowledgement.
  const displayStatus: JobStatusDisplay =
    card.status === JobStatus.JOB_PLACED && !card.acknowledgement_sent_at
      ? 'Pending'
      : mapped.status;

  // A held job keeps the kanban column it was in before the hold, instead of
  // jumping to HOLD's fallback stage — only the status label/badge changes.
  const stage: JobStage =
    card.status === JobStatus.HOLD && card.pre_hold_status
      ? (STATUS_MAP[card.pre_hold_status]?.stage ?? mapped.stage)
      : mapped.stage;

  const effectiveAcknowledgedAt = card.acknowledgement_sent_at
    ? new Date(new Date(card.acknowledgement_sent_at).getTime() + (card.total_held_ms ?? 0)).toISOString()
    : null;

  const assignedUserId =
    card.current_handler_id ??
    card.assigned_senior_id ??
    card.assigned_junior_id ??
    card.assigned_sewout_id ??
    null;

  const assignedTo = assignedUserId ? (usersMap.get(assignedUserId) ?? null) : null;

  const subType: 'Senior' | 'Junior' | null = card.assigned_senior_id
    ? 'Senior'
    : card.assigned_junior_id
      ? 'Junior'
      : null;

  const clientInfo = card.client_info
    ? { name: card.client_info.company_name ?? card.client_info.client_name, clientId: card.client_info.client_id }
    : clientsMap.get(card.client_id);
  const cardExpiry = card.client_info
    ? resolveClientCardExpiry({
        card_on_file:
          card.client_info.card_exp_month != null && card.client_info.card_exp_year != null
            ? { exp_month: card.client_info.card_exp_month, exp_year: card.client_info.card_exp_year }
            : null,
        payment_mode: card.client_info.payment_mode,
        payment_details: card.client_info.payment_details,
      })
    : null;

  return {
    id: card.job_id,
    uuid: card.id,
    version: card.version,
    ref: normalizeRefNumber(card.reference_number),
    client: clientInfo?.name ?? card.mail,
    clientId: clientInfo?.clientId ?? card.client_id,
    design: card.design_name,
    summary: card.description ?? card.mail_description ?? '',
    order: ORDER_DISPLAY[card.order_type] ?? 'Artwork',
    project: PROJECT_DISPLAY[card.project_type] ?? 'Live',
    complexity: card.design_complexity
      ? (COMPLEXITY_DISPLAY[card.design_complexity] ?? 'Simple')
      : 'Simple',
    process: card.process_type ? (PROCESS_DISPLAY[card.process_type] ?? null) : null,
    priority: PRIORITY_DISPLAY[card.priority] ?? 'Normal',
    etaHours: card.eta_hours,
    status: displayStatus,
    rawStatus: card.status,
    stage,
    assignedTo,
    subType,
    specificType: card.specific_type ?? null,
    finalFiles: card.final_files ?? [],
    notes: card.notes ?? '',
    // Surface the agency-set quote so the JobDetailModal can render the
    // already-sent price as read-only when the job is in QUOTE_APPROVED.
    adminPrice: card.admin_price ?? null,
    adminPriceNote: card.admin_price_note ?? null,
    adminPriceCurrency: card.admin_price_currency ?? null,
    colors: card.num_colors ?? 0,
    created: card.time_and_date ?? card.created_at,
    aiScore: null,
    placement: card.placement ? (PLACEMENT_DISPLAY[card.placement] ?? undefined) : undefined,
    width: card.width_inches ?? undefined,
    height: card.height_inches ?? undefined,
    fabric: card.fabric ?? undefined,
    stitchCount: card.stitch_count ?? undefined,
    acknowledgedAt: card.acknowledgement_sent_at
      ? String(card.acknowledgement_sent_at)
      : null,
    effectiveAcknowledgedAt,
    preHoldStatus: card.pre_hold_status ?? null,
    heldAt: card.held_at ?? null,
    totalHeldMs: card.total_held_ms ?? 0,
    isAdminCopy: card.is_admin_copy ?? false,
    parentJobId: card.parent_job_id ?? null,
    hasAdminCopy: card.has_admin_copy ?? false,
    clientPo: card.client_po ?? null,
    modificationCount: card.modification_count ?? 0,
    modificationNotes: card.modification_notes ?? null,
    clientCardExpMonth: cardExpiry?.exp_month ?? null,
    clientCardExpYear: cardExpiry?.exp_year ?? null,
    clientPaymentMode: card.client_info?.payment_mode ?? null,
    clientPreviousOrderAt: card.client_previous_order_at ?? null,
  };
}
