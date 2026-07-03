import { JobStatus, Priority, type JobStatus as JobStatusType } from '@contracts';
import { cn } from '@lib/utils';

type BadgeAccent = 'crimson' | 'blue' | 'teal' | 'amber' | 'green' | 'red' | 'purple' | 'gray';

/**
 * Map a JobStatus to:
 *   • a tone (the demo's badge colour family)
 *   • a short label for table cells / chips
 *
 * Color alone is never the signal — every badge also renders text (a11y).
 */
const STATUS_PRESENTATION: Record<JobStatusType, { accent: BadgeAccent; label: string }> = {
  [JobStatus.DRAFT]: { accent: 'gray', label: 'Draft' },
  [JobStatus.QUOTE_SUBMITTED]: { accent: 'crimson', label: 'Quote Submitted' },
  [JobStatus.QUOTE_APPROVED]: { accent: 'green', label: 'Quote Approved' },
  [JobStatus.QUOTE_REJECTED]: { accent: 'red', label: 'Quote Rejected' },
  [JobStatus.JOB_PLACED]: { accent: 'blue', label: 'Job Placed' },
  [JobStatus.CS_APPROVED]: { accent: 'blue', label: 'Client Servicing Approved' },
  [JobStatus.ASSIGNED]: { accent: 'blue', label: 'Assigned' },
  [JobStatus.IN_PROGRESS]: { accent: 'amber', label: 'In Progress' },
  [JobStatus.SUBMITTED_TO_SENIOR]: { accent: 'purple', label: 'To Senior' },
  [JobStatus.SENIOR_REVIEW]: { accent: 'purple', label: 'Senior Review' },
  [JobStatus.SENIOR_REJECTED]: { accent: 'red', label: 'Senior Rejected' },
  [JobStatus.SUBMITTED_TO_SEWOUT]: { accent: 'amber', label: 'To Sewout' },
  [JobStatus.SEWOUT_IN_PROGRESS]: { accent: 'amber', label: 'Sewout' },
  [JobStatus.SUBMITTED_TO_QC]: { accent: 'purple', label: 'To QC' },
  [JobStatus.QC_REVIEW]: { accent: 'purple', label: 'In QC' },
  [JobStatus.QC_APPROVED]: { accent: 'green', label: 'QC Passed' },
  [JobStatus.QC_REJECTED]: { accent: 'red', label: 'QC Rejected' },
  [JobStatus.READY_TO_DELIVER]: { accent: 'teal', label: 'Ready' },
  [JobStatus.DELIVERED]: { accent: 'teal', label: 'Dispatched' },
  [JobStatus.MODIFICATION_REQUESTED]: { accent: 'amber', label: 'Mod Requested' },
  [JobStatus.CLOSED]: { accent: 'gray', label: 'Closed' },
  [JobStatus.CANCELLED]: { accent: 'gray', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: JobStatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { accent, label } = STATUS_PRESENTATION[status];
  return (
    <span className={cn('badge', accent, className)} aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const map: Record<Priority, { cls: string; label: string }> = {
    [Priority.NORMAL]: { cls: 'normal', label: 'Normal' },
    [Priority.RUSH]: { cls: 'rush', label: 'Rush' },
    [Priority.SUPER_RUSH]: { cls: 'super-rush', label: 'Super Rush' },
  };
  const { cls, label } = map[priority];
  return (
    <span className={cn('priority-badge', cls, className)} aria-label={`Priority: ${label}`}>
      {label}
    </span>
  );
}
