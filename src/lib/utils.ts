import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { config } from './config';

/** shadcn-style className helper. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as the tenant's default currency. Strings are accepted so
 * Postgres decimal values (sent as JSON strings to preserve precision) can
 * be passed without `parseFloat` at every callsite.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  opts: { currency?: string; locale?: string } = {},
): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(opts.locale ?? config.defaultLocale, {
    style: 'currency',
    currency: opts.currency ?? config.defaultCurrency,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Convert an `IsoDateTime` string into the user's local formatted string.
 * Returns "—" for null/empty inputs so tables never render "Invalid Date".
 */
export function formatDateTime(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(config.defaultLocale, opts).format(d);
}

/** Initials helper for avatars (e.g. "Kavya Reddy" → "KR"). */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Pluralise helper — "1 job" / "5 jobs". */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm ?? `${singular}s`}`;
}

/**
 * Normalise a reference number to the DDMMYYYY-ClientID-JobNo-Suffix format.
 * Handles legacy DD-MM-YYYY-... strings stored before the format change.
 */
export function normalizeRefNumber(ref: string | null | undefined): string {
  if (!ref) return '—';
  // Legacy format: DD-MM-YYYY-rest  →  DDMMYYYY-rest
  const legacy = ref.match(/^(\d{2})-(\d{2})-(\d{4})-(.+)$/);
  if (legacy) return `${legacy[1]}${legacy[2]}${legacy[3]}-${legacy[4]}`;
  return ref;
}

/**
 * Strip embedded `[Label: Value]` metadata tags from a job brief/description,
 * returning only the client's free-text message for compact card summaries.
 */
export function briefText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/\[\s*[^:\]]+?\s*:\s*[^\]]*?\s*\]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Truncate a display string to `max` chars, appending an ellipsis if cut. */
export function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Tailwind classname for a numeric trend delta. */
export function deltaToneClass(delta: number): string {
  if (delta > 0) return 'text-status-green';
  if (delta < 0) return 'text-status-red';
  return 'text-text-muted';
}

const LEGACY_ETA_STATUSES = new Set([
  'In Production',
  'Senior Review',
  'Sewout',
  'In QC',
  'Ready to Deliver',
]);
const LEGACY_ETA_DURATION_MS = 4 * 3600_000; // 4 hours

/**
 * Check if a job's ETA timer is over/expired.
 */
export function isJobEtaExpired(job: {
  acknowledgedAt?: string | null;
  etaHours?: number | null;
  status: string;
  created?: string | Date | null;
}): boolean {
  const now = Date.now();
  // Case 1: acknowledged ETA
  if (job.acknowledgedAt && job.etaHours != null && job.etaHours > 0) {
    const endMs = new Date(job.acknowledgedAt).getTime() + job.etaHours * 3600_000;
    return now >= endMs;
  }
  // Case 2: legacy SLA timer for non-acknowledged production stages
  if (LEGACY_ETA_STATUSES.has(job.status)) {
    const placedAt = job.created ? new Date(job.created).getTime() : null;
    if (placedAt && !isNaN(placedAt)) {
      return now >= placedAt + LEGACY_ETA_DURATION_MS;
    }
  }
  return false;
}
