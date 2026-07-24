import { NavLink } from 'react-router-dom';
import { ClipboardList, ExternalLink, Gauge, Pencil, ScrollText } from 'lucide-react';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { GreetingHero, Panel } from '@modules/shared-ui';
import { NAV_CONFIG } from '@modules/shared-ui/nav-config';
import { initials } from '@lib/utils';
import { UserSubType } from '@contracts';

type Accent = 'crimson' | 'blue' | 'teal';

const ACCENT_BG: Record<Accent, string> = {
  crimson: 'rgba(196,30,58,0.12)',
  blue:    'rgba(59,130,246,0.12)',
  teal:    'rgba(45,212,191,0.12)',
};

const ACCENT_COLOR: Record<Accent, string> = {
  crimson: '#ff8a95',
  blue:    '#93c5fd',
  teal:    '#5eead4',
};

const ACCESS_ITEMS: { icon: React.ReactNode; text: string; accent: Accent }[] = [
  {
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    text: 'My Tasks — accept assigned briefs and execute production work',
    accent: 'crimson',
  },
  {
    icon: <ScrollText className="w-3.5 h-3.5" />,
    text: 'Submitted — track work handed off for review',
    accent: 'blue',
  },
  {
    icon: <Gauge className="w-3.5 h-3.5" />,
    text: 'My Analytics — personal throughput and turnaround stats',
    accent: 'teal',
  },
];

const QUICK_LINKS = [
  { label: 'My Tasks',    to: '/designer' },
  { label: 'Submitted',   to: '/designer/submitted' },
  { label: 'My Analytics', to: '/designer/analytics' },
];

export function DesignerProfilePage() {
  const user = useSessionUser();
  if (!user) return null;

  const roleLabel = NAV_CONFIG[user.role]?.label ?? 'Designer';

  const subTypeLabel = user.sub_type === UserSubType.SENIOR
    ? 'Senior'
    : user.sub_type === UserSubType.JUNIOR
    ? 'Junior'
    : null;

  return (
    <div className="page">
      <GreetingHero
        title="My Profile"
        subtitle="Your account details and access overview."
        action={
          <button type="button" className="btn btn-outline gap-2" disabled title="Profile editing coming soon">
            <Pencil aria-hidden className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        }
      />

      {/* ── Profile Header ── */}
      <div
        className="panel mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.05), rgba(0,40,104,0.1))' }}
      >
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-[28px] font-bold select-none"
              style={{
                background: 'linear-gradient(135deg, var(--color-crimson), var(--color-crimson-dim))',
                border: '2px solid rgba(255,255,255,0.18)',
                boxShadow: '0 4px 24px var(--color-crimson-glow)',
              }}
              aria-hidden
            >
              {initials(user.name)}
            </div>
            {user.is_active && (
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
                style={{
                  background: 'var(--color-green)',
                  borderColor: 'var(--glass-bg)',
                }}
                aria-label="Account active"
              />
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2 className="text-[22px] font-bold text-text-main leading-tight tracking-tight truncate">
              {user.name}
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5 font-mono break-all leading-snug">{user.email}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="badge crimson">{roleLabel}</span>
              {user.is_active
                ? <span className="badge green">Active</span>
                : <span className="badge red">Inactive</span>}
              {subTypeLabel && <span className="badge blue">{subTypeLabel}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column content ── */}
      <div className="two-col">

        {/* Left — Account Details */}
        <Panel title="Account Details">
          <dl>
            <DetailRow label="Full Name">
              <span className="font-semibold">{user.name}</span>
            </DetailRow>
            <DetailRow label="Email">
              <span className="font-mono text-[11px] break-all">{user.email}</span>
            </DetailRow>
            <DetailRow label="User ID">
              <span className="ref-code font-mono text-[10px] break-all">{user.id}</span>
            </DetailRow>
            <DetailRow label="Role">
              <span>{roleLabel}</span>
            </DetailRow>
            <DetailRow label="Sub-type">
              {subTypeLabel
                ? <span className="badge blue">{subTypeLabel}</span>
                : <span className="text-text-faint text-[12px]">— not applicable</span>}
            </DetailRow>
            <DetailRow label="Account Status">
              {user.is_active
                ? <span className="badge green">Active</span>
                : <span className="badge red">Inactive</span>}
            </DetailRow>
            <DetailRow label="Tenant ID" last>
              <span className="ref-code font-mono text-[10px] break-all">{user.tenant_id}</span>
            </DetailRow>
          </dl>
        </Panel>

        {/* Right — Access + Quick Links */}
        <div className="flex flex-col gap-3">

          {/* Platform Access */}
          <Panel title="My Access">
            <ul className="space-y-3">
              {ACCESS_ITEMS.map(({ icon, text, accent }) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-[1px]"
                    style={{ background: ACCENT_BG[accent], color: ACCENT_COLOR[accent] }}
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span className="text-[12.5px] text-text-muted leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Quick Links */}
          <Panel title="Quick Links">
            <div className="flex flex-col gap-1.5">
              {QUICK_LINKS.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-glass-border text-[12.5px] text-text-muted hover:border-glass-border-bright hover:text-text-main transition"
                >
                  {label}
                  <ExternalLink aria-hidden className="w-3 h-3 opacity-40" />
                </NavLink>
              ))}
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}

/* ── Detail row helper ── */
function DetailRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 py-3 ${!last ? 'border-b border-glass-border' : ''}`}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted w-24 flex-shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className="text-[13px] text-text-main flex-1 min-w-0 overflow-hidden">{children}</dd>
    </div>
  );
}
