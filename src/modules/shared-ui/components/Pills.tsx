import { cn } from '@lib/utils';

export interface PillItem {
  id: string;
  label: string;
  count?: number;
  /** Small status dot rendered before the label (e.g. '#22c55e'). Omit for a plain pill like "All". */
  dotColor?: string;
}

interface PillsProps {
  items: PillItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Pill filter row — matches `.pills` in the demo. Clicking a pill is the only
 * effect; the parent owns filtering logic.
 */
export function Pills({ items, activeId, onSelect, className }: PillsProps) {
  return (
    <div className={cn('pills-segmented-bar flex-nowrap overflow-x-auto scrollbar-none', className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          className={cn('pill-segmented-item whitespace-nowrap shrink-0', item.id === activeId && 'active')}
          onClick={() => onSelect(item.id)}
        >
          {item.dotColor ? (
            <span
              className="pill-dot"
              style={{ borderColor: item.dotColor, color: item.dotColor }}
              aria-hidden
            />
          ) : null}
          <span className="pill-label whitespace-nowrap">{item.label}</span>
          {typeof item.count === 'number' ? <span className="pill-count whitespace-nowrap">({item.count})</span> : null}
        </button>
      ))}
    </div>
  );
}
