import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@lib/utils';

export type StatAccent = 'crimson' | 'gold' | 'teal' | 'green' | 'blue' | 'purple' | 'amber';

export interface StatCardProps {
  accent: StatAccent;
  label?: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaDirection?: 'up' | 'down' | 'none';
  /** Icon rendered in the top-right corner (lucide-react element). */
  icon?: ReactNode;
  /** If provided, the card becomes a clickable link. */
  href?: string;
}

export function StatCard({
  accent,
  label,
  value,
  delta,
  deltaDirection = 'none',
  icon,
  href,
}: StatCardProps) {
  const inner = (
    <>
      {icon ? <span className="stat-ico" aria-hidden>{icon}</span> : null}
      {label ? <div className="stat-label">{label}</div> : null}
      <div className="stat-value">{value}</div>
      {delta ? (
        <div className={cn('stat-delta', deltaDirection !== 'none' && deltaDirection)}>{delta}</div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={cn('stat-card', accent)} style={{ textDecoration: 'none', cursor: 'pointer' }}>
        {inner}
      </Link>
    );
  }

  return (
    <article className={cn('stat-card', accent)}>
      {inner}
    </article>
  );
}

interface StatGridProps {
  stats: StatCardProps[];
  className?: string;
}

export function StatGrid({ stats, className }: StatGridProps) {
  return (
    <section className={cn('stats-grid', className)} aria-label="Stats">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </section>
  );
}
