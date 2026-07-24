/**
 * Client Inactivity Indicator — buckets the elapsed time since a client's
 * most recent order into a coarse, at-a-glance signal for CS/Admin ("is this
 * client still active, or have they gone quiet on us?").
 */
export type ClientActivityBucket =
  | 'less_than_1_day'
  | 'less_than_2_days'
  | 'less_than_1_week'
  | 'less_than_2_weeks'
  | 'less_than_1_month'
  | 'less_than_2_months'
  | 'less_than_6_months'
  | 'more_than_6_months';

const DAY_MS = 24 * 60 * 60 * 1000;

const BUCKET_LABELS: Record<ClientActivityBucket, string> = {
  less_than_1_day: 'Less than 1 day',
  less_than_2_days: 'Less than 2 days',
  less_than_1_week: 'Less than 1 week',
  less_than_2_weeks: 'Less than 2 weeks',
  less_than_1_month: 'Less than 1 month',
  less_than_2_months: 'Less than 2 months',
  less_than_6_months: 'Less than 6 months',
  more_than_6_months: 'More than 6 months',
};

/** Loosely: green = recently active, amber = cooling off, red = gone quiet. */
const BUCKET_ACCENT: Record<ClientActivityBucket, 'good' | 'warn' | 'stale'> = {
  less_than_1_day: 'good',
  less_than_2_days: 'good',
  less_than_1_week: 'good',
  less_than_2_weeks: 'good',
  less_than_1_month: 'warn',
  less_than_2_months: 'warn',
  less_than_6_months: 'stale',
  more_than_6_months: 'stale',
};

export function getClientActivityBucket(
  previousOrderAt: string | null | undefined,
): ClientActivityBucket | null {
  if (!previousOrderAt) return null;
  const elapsedMs = Date.now() - new Date(previousOrderAt).getTime();
  if (elapsedMs <= 0) return 'less_than_1_day'; // clock skew / just-now guard
  const days = elapsedMs / DAY_MS;
  if (days < 1) return 'less_than_1_day';
  if (days < 2) return 'less_than_2_days';
  if (days < 7) return 'less_than_1_week';
  if (days < 14) return 'less_than_2_weeks';
  if (days < 30) return 'less_than_1_month';
  if (days < 60) return 'less_than_2_months';
  if (days < 182) return 'less_than_6_months';
  return 'more_than_6_months';
}

export function formatClientActivityBucket(bucket: ClientActivityBucket | null): string {
  return bucket ? BUCKET_LABELS[bucket] : 'No previous orders';
}

export function clientActivityAccent(bucket: ClientActivityBucket | null): 'good' | 'warn' | 'stale' | 'neutral' {
  return bucket ? BUCKET_ACCENT[bucket] : 'neutral';
}
