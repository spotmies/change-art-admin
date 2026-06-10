import type { ReactNode } from 'react';
import { cn } from '@lib/utils';

interface PanelProps {
  title?: ReactNode;
  /** Optional element rendered to the right of the title (e.g. View All link). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Glass panel — the demo's primary content container.
 * Use SectionHeader for groups of panels that share a heading row.
 */
export function Panel({ title, action, className, children }: PanelProps) {
  return (
    <section className={cn('panel', className)}>
      {title ? (
        <header className="panel-title flex items-center gap-2">
          <span>{title}</span>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  const showLine = typeof title === 'string' && title === 'Recent Jobs';

  return (
    <div className={cn('sec-header flex items-center gap-4 w-full', className)}>
      <h2 className="sec-title whitespace-nowrap">{title}</h2>
      {showLine ? (
        <div className="flex-grow border-t border-[#E4E8F0]" />
      ) : null}
      {action ? (
        <div className={cn('sec-action whitespace-nowrap', !showLine && 'ml-auto')}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
