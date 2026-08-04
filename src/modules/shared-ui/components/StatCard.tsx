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

/* ─── CS Dashboard Stat Card (icon-left layout) ─── */

export type CsStatAccent = 'cs-green' | 'cs-blue' | 'cs-purple' | 'cs-orange' | 'cs-amber' | 'cs-teal';

export interface CsStatCardProps {
  accent: CsStatAccent;
  /** Short uppercase tag label, e.g. "LIVE" */
  tag: string;
  /** Sub-description under the tag, e.g. "Direct Orders" */
  description: string;
  /** Big numeric count */
  value: number | string;
  /** Small status text under count, e.g. "Waiting Assignment" */
  statusText: string;
  /** Icon element (lucide-react) */
  icon: ReactNode;
  /** If provided, card becomes a link */
  href?: string;
}

export function CsStatCard({ accent, tag, description, value, statusText, icon, href }: CsStatCardProps) {
  const inner = (
    <>
      <div className="cs-stat-icon" aria-hidden>
        {icon}
      </div>
      <div className="cs-stat-content">
        <div className="cs-stat-tag">{tag}</div>
        <div className="cs-stat-desc">{description}</div>
        <div className="cs-stat-value">{value}</div>
        <div className="cs-stat-sub">{statusText}</div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={cn('stat-card-cs', accent)} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={cn('stat-card-cs', accent)}>
      {inner}
    </div>
  );
}

interface CsStatGridProps {
  stats: CsStatCardProps[];
}

export function CsStatGrid({ stats }: CsStatGridProps) {
  return (
    <section className="stats-grid-cs" aria-label="Stats">
      {stats.map((s) => (
        <CsStatCard key={s.tag} {...s} />
      ))}
    </section>
  );
}
