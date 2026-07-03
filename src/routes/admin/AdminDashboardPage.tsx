import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import {
  BarChart,
  GreetingHero,
  JobTable,
  Panel,
  SectionHeader,
  StatGrid,
} from '@modules/shared-ui';
import { AlertTriangle, CheckCircle2, Send, Sparkles, Target, TrendingUp } from 'lucide-react';
import {
  useAdminJobViews,
} from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';

export function AdminDashboardPage() {
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? 'Admin';

  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  // per_page: 1 — we only need meta.total for the "Total Clients" stat card; no items are used.
  const { data: clientsData } = useAdminClients({ per_page: 1 });

  const active   = useMemo(
    () => jobs.filter((j) => j.stage !== 'quote' && j.stage !== 'delivered' && j.status !== 'Cancelled'),
    [jobs],
  );
  const inProd   = useMemo(() => jobs.filter((j) => j.stage === 'junior' || j.stage === 'senior'), [jobs]);
  const inQc     = useMemo(() => jobs.filter((j) => j.stage === 'qc'), [jobs]);
  const inSewout = useMemo(() => jobs.filter((j) => j.stage === 'sewout'), [jobs]);
  const delivered = useMemo(() => jobs.filter((j) => j.stage === 'delivered'), [jobs]);

  const newJobs   = useMemo(() => active.slice(0, 4), [active]);
  const newQuotes = useMemo(() => jobs.filter((j) => j.stage === 'quote').slice(0, 4), [jobs]);

  const totalClients = clientsData?.meta.total ?? 0;

  const totalActive = active.length;
  const prodPct = totalActive ? Math.round((inProd.length / totalActive) * 100) : 0;

  // ── Analytics computations ──────────────────────────────────────────────

  // Missed Deadlines: active jobs whose ETA window has already elapsed
  const missedDeadlines = useMemo(() => {
    const now = Date.now();
    return active.filter((j) => {
      const deadline = new Date(j.created).getTime() + (j.etaHours ?? 0) * 3_600_000;
      return deadline < now;
    }).length;
  }, [active]);

  // Achieved Targets: delivered jobs (completed successfully)
  const achievedTargets = delivered.length;

  // Weekly Trend: jobs created on each weekday of the current week (Mon–Fri)
  const weeklyData = useMemo(() => {
    const now = new Date();
    // Start of this week's Monday
    const dayOfWeek = now.getDay(); // 0 = Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const counts = [0, 0, 0, 0, 0];
    for (const job of jobs) {
      const created = new Date(job.created);
      const dayIdx = Math.floor((created.getTime() - monday.getTime()) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < 5) counts[dayIdx]++;
    }

    const maxVal = Math.max(...counts, 1);
    const colors = [
      'var(--color-teal)',
      'var(--color-amber)',
      'var(--color-purple, #a855f7)',
      'var(--color-blue)',
      undefined,
    ];
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => ({
      label,
      value: counts[i],
      height: Math.max(Math.round((counts[i] / maxVal) * 100), 4),
      color: colors[i],
      highlight: i === 4,
    }));
  }, [jobs]);

  // Production Trends: jobs created each day for the last 7 days
  const productionTrends = useMemo(() => {
    const result: { label: string; value: number; height: number; color: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = jobs.filter((j) => {
        const d = new Date(j.created);
        return d >= day && d < nextDay;
      }).length;
      result.push({
        label: day.toLocaleDateString('en', { weekday: 'short' }),
        value: count,
        height: 0,
        color: 'var(--color-blue)',
      });
    }
    const maxVal = Math.max(...result.map((r) => r.value), 1);
    return result.map((r) => ({ ...r, height: Math.max(Math.round((r.value / maxVal) * 100), 4) }));
  }, [jobs]);



  const loading = (v: number | string) => (isLoading ? '…' : v);

  return (
    <div className="page">
      <GreetingHero
        title={`Good ${getGreeting()}, ${firstName}`}
        subtitle="Platform-wide overview. Full access to all modules."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/admin/create-quote"
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              New Quote
            </Link>
            <Link
              to="/admin/place-order"
              className="btn btn-crimson"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              Place Order
            </Link>
          </div>
        }
      />

      {/* Row 1 — Core job volume stats */}
      <StatGrid
        className="stats-grid-6"
        stats={[
          { accent: 'blue',    label: 'Open Jobs',       value: loading(active.length),    href: '/admin/jobs' },
          { accent: 'amber',   label: 'In Production',   value: loading(inProd.length),    href: '/admin/jobs' },
          { accent: 'teal',    label: 'In QC',           value: loading(inQc.length),      href: '/admin/jobs' },
          {
            accent: 'green',
            label: 'Sewout',
            value: loading(inSewout.length),
            delta: 'Jobs in sewout stage',
            deltaDirection: 'up',
            icon: <Send aria-hidden />,
            href: '/admin/jobs',
          },
          {
            accent: 'purple',
            label: 'Dispatched',
            value: loading(delivered.length),
            delta: 'Completed jobs',
            deltaDirection: 'up',
            icon: <CheckCircle2 aria-hidden />,
            href: '/admin/jobs',
          },
          {
            accent: 'crimson',
            label: 'Total Clients',
            value: loading(totalClients),
            delta: 'Registered accounts',
            deltaDirection: 'up',
            href: '/admin/clients',
          },
        ]}
      />

      {/* Row 2 — Analytics metrics */}
      <StatGrid
        className="stats-grid-4"
        stats={[
          {
            accent: 'crimson',
            label: 'Missed Deadlines',
            value: loading(missedDeadlines),
            delta: 'Active jobs past ETA',
            deltaDirection: missedDeadlines > 0 ? 'down' : 'none',
            icon: <AlertTriangle aria-hidden />,
            href: '/admin/jobs',
          },
          {
            accent: 'green',
            label: 'Achieved Targets',
            value: loading(achievedTargets),
            delta: 'Jobs delivered',
            deltaDirection: 'up',
            icon: <Target aria-hidden />,
            href: '/admin/jobs',
          },
          {
            accent: 'teal',
            label: 'This Week',
            value: loading(weeklyData.reduce((s, d) => s + d.value, 0)),
            delta: 'Jobs created this week',
            deltaDirection: 'up',
            icon: <TrendingUp aria-hidden />,
          },
          {
            accent: 'blue',
            label: 'On-Time Rate',
            value: loading(
              active.length + delivered.length > 0
                ? `${Math.round((achievedTargets / Math.max(active.length + delivered.length, 1)) * 100)}%`
                : '—',
            ),
            delta: 'Delivered vs total jobs',
            deltaDirection: 'up',
          },
        ]}
      />

      <div className="two-col">
        {/* Left — job tables */}
        <div>
          <SectionHeader
            title={<span style={{ color: '#0D9488' }}>New Jobs</span>}
            action={<Link to="/admin/new-jobs" className="sec-action-link">View All →</Link>}
          />
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-text-faint text-sm">Loading…</div>
          ) : (
            <JobTable jobs={newJobs} defaultView="grid" showActions />
          )}

          <div className="mt-7">
            <SectionHeader
              title={<span style={{ color: '#D97706' }}>New Quote Requests</span>}
              action={<Link to="/admin/new-quotes" className="sec-action-link">View All →</Link>}
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-text-faint text-sm">Loading…</div>
            ) : (
              <JobTable jobs={newQuotes} defaultView="grid" showActions quoteView />
            )}
          </div>
        </div>

        {/* Right — analytics panels */}
        <div className="flex flex-col gap-3">

          {/* Jobs Status donut */}
          <Panel>
            <div className="flex items-center gap-5">
              <div
                role="img"
                aria-label="Jobs status donut"
                style={{
                  width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
                  background: totalActive
                    ? `conic-gradient(var(--color-teal) 0% ${prodPct}%, var(--color-amber) ${prodPct}% 100%)`
                    : 'var(--glass-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{
                  width: 62, height: 62, borderRadius: '50%',
                  background: 'var(--glass-bg)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.15)',
                }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 18, fontWeight: 700, lineHeight: 1, color: 'var(--text-main)' }}>
                    {isLoading ? '…' : totalActive}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginTop: 2 }}>
                    Active
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2.5">
                  Jobs Status
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: 'var(--color-teal)' }} />
                    <span className="text-[12px] text-text-muted font-medium flex-1">In Production</span>
                    <span className="text-[12px] font-bold text-text-main">{isLoading ? '…' : inProd.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: 'var(--color-amber)' }} />
                    <span className="text-[12px] text-text-muted font-medium flex-1">In QC</span>
                    <span className="text-[12px] font-bold text-text-main">{isLoading ? '…' : inQc.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: 'var(--color-purple, #a855f7)' }} />
                    <span className="text-[12px] text-text-muted font-medium flex-1">Sewout</span>
                    <span className="text-[12px] font-bold text-text-main">{isLoading ? '…' : inSewout.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Weekly Trend (dynamic) */}
          <Panel title="Weekly Trend">
            <BarChart items={weeklyData} />
          </Panel>

          {/* Production Trends — last 7 days */}
          <Panel title="Production Trends" className="panel-blue">
            <BarChart items={productionTrends} />
          </Panel>

        </div>
      </div>

    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
