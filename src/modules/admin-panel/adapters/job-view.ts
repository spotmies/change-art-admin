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
  [ProjectType.LIVE_QUOTE]: 'Live',
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
  [JobStatus.DELIVERED]: { status: 'Delivered', stage: 'delivered' },
  [JobStatus.MODIFICATION_REQUESTED]: { status: 'Amend', stage: 'qc' },
  [JobStatus.CLOSED]: { status: 'Delivered', stage: 'delivered' },
  [JobStatus.CANCELLED]: { status: 'Cancelled', stage: 'quote' },
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

  const clientInfo = clientsMap.get(card.client_id);

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
    status: mapped.status,
    rawStatus: card.status,
    stage: mapped.stage,
    assignedTo,
    subType,
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
    isAdminCopy: card.is_admin_copy ?? false,
    parentJobId: card.parent_job_id ?? null,
    hasAdminCopy: card.has_admin_copy ?? false,
  };
}
