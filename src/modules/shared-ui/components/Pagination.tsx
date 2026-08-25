import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Standard paginator — shows page range info, prev/next, and up to 7 numbered
 * page buttons with ellipsis compression for large ranges.
 */
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  // Build the page number list: always show first/last, current ±2, with … gaps.
  const pages = buildPages(page, totalPages);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 w-full px-1', className)}>
      {/* Range info */}
      <span className="text-xs text-text-muted tabular-nums text-center sm:text-left font-medium">
        Showing <span className="text-text-main font-semibold">{from}–{to}</span> of <span className="text-text-main font-semibold">{total}</span>
      </span>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1 max-w-full overflow-x-auto py-1 scrollbar-none shrink-0">
        <PageBtn
          label="Previous"
          icon={<ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-text-faint text-[12px] select-none shrink-0">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'min-w-[32px] h-8 sm:min-w-[28px] sm:h-7 px-2.5 sm:px-2 rounded-lg sm:rounded text-[12px] font-semibold transition-all shrink-0 flex items-center justify-center cursor-pointer',
                p === page
                  ? 'bg-[var(--color-blue)] text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-white/10 active:scale-95',
              )}
            >
              {p}
            </button>
          ),
        )}

        <PageBtn
          label="Next"
          icon={<ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

function PageBtn({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg sm:rounded transition-all shrink-0',
        disabled
          ? 'text-text-faint cursor-not-allowed opacity-35'
          : 'text-text-muted hover:text-text-main hover:bg-white/10 active:scale-95 cursor-pointer',
      )}
    >
      {icon}
    </button>
  );
}

function buildPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const result: (number | '…')[] = [];
  const around = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));

  let prev = 0;
  for (const p of [...around].sort((a, b) => a - b)) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}
