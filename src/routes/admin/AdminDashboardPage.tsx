import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import {
  BarChart,
  Callout,
  DonutChart,
  GreetingHero,
  JobTable,
  Panel,
  SectionHeader,
  StatGrid,
} from '@modules/shared-ui';
import { CheckCircle2, Cog, Layers, Send, Sparkles } from 'lucide-react';
import {
  useAdminJobViews,
} from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { getCardExpiryStatus, resolveClientCardExpiry } from '@lib/card-expiry';

export function AdminDashboardPage() {
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? 'Admin';

  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  // per_page: 1 — we only need meta.total for the "Total Clients" stat; no items are used.
  const { data: clientsData } = useAdminClients({ per_page: 1 });
  // Separate fetch (up to 100 clients) to scan for cards expired/expiring soon —
  // mirrors the same "fetch a page, compute client-side" pattern used for jobs above.
  const { data: clientsForExpiryCheck } = useAdminClients({ per_page: 100 });
  const expiringCards = useMemo(() => {
    const items = clientsForExpiryCheck?.items ?? [];
    return items
      .map((c) => ({ client: c, status: getCardExpiryStatus(resolveClientCardExpiry(c)) }))
      .filter((c): c is { client: (typeof items)[number]; status: 'expired' | 'expiring_soon' } =>
        c.status === 'expired' || c.status === 'expiring_soon',
      );
  }, [clientsForExpiryCheck]);
  const expiredCount = expiringCards.filter((c) => c.status === 'expired').length;
  const expiringSoonCount = expiringCards.filter((c) => c.status === 'expiring_soon').length;

  const active = useMemo(
    () => jobs.filter((j) => j.stage !== 'quote' && j.stage !== 'delivered' && j.status !== 'Cancelled'),
    [jobs],
  );
  // "In Production" for the dashboard donut/stat covers every active job that
  // isn't in QC or Sewout yet — including ones still "Pending" acknowledgement
  // and ones out for "Senior Review" — so this bucket plus inQc/inSewout always
  // adds up to the "Active" total shown at the donut's center. (The Jobs page
  // itself still filters "Pending" and "Senior Review" as their own statuses.)
  const inProd = useMemo(
    () => jobs.filter((j) => j.stage === 'junior' || j.stage === 'senior'),
    [jobs],
  );
  const inQc = useMemo(() => jobs.filter((j) => j.stage === 'qc'), [jobs]);
  const inSewout = useMemo(() => jobs.filter((j) => j.stage === 'sewout'), [jobs]);
  const delivered = useMemo(() => jobs.filter((j) => j.stage === 'delivered'), [jobs]);

  const newJobs = useMemo(() => active.slice(0, 4), [active]);
  const newQuotesAll = useMemo(() => jobs.filter((j) => j.stage === 'quote'), [jobs]);
  const newQuotes = useMemo(() => newQuotesAll.slice(0, 4), [newQuotesAll]);

  const totalClients = clientsData?.meta.total ?? 0;
  const totalActive = active.length;

  // Missed Deadlines: active jobs whose ETA window has already elapsed
  const missedDeadlines = useMemo(() => {
    const now = Date.now();
    return active.filter((j) => {
      const deadline = new Date(j.created).getTime() + (j.etaHours ?? 0) * 3_600_000;
      return deadline < now;
    }).length;
  }, [active]);

  const onTimeRate = totalActive + delivered.length > 0
    ? Math.round((delivered.length / Math.max(totalActive + delivered.length, 1)) * 100)
    : null;

  // Activity Trend: a rolling 7-day trailing window ending today, so it keeps
  // scrolling forward day by day instead of dropping back to empty every time
  // the calendar week turns over (which is what a fixed Mon–Sun window does).
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return d;
    });

    const counts = days.map((day) => {
      const dayStart = day.getTime();
      const dayEnd = dayStart + 86_400_000;
      return jobs.filter((job) => {
        const created = new Date(job.created).getTime();
        return created >= dayStart && created < dayEnd;
      }).length;
    });

    const maxVal = Math.max(...counts, 1);
    return days.map((day, i) => ({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      value: counts[i],
      height: Math.max(Math.round((counts[i] / maxVal) * 100), 4),
      highlight: i === 6,
    }));
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

      <StatGrid
        stats={[
          {
            accent: 'crimson',
            label: 'Open Jobs',
            value: loading(totalActive),
            delta: 'Active pipeline',
            deltaDirection: 'up',
            icon: <Layers aria-hidden />,
            href: '/admin/jobs',
          },
          {
            accent: 'amber',
            label: 'In Production',
            value: loading(inProd.length),
            delta: `${inQc.length} in QC`,
            icon: <Cog aria-hidden />,
            href: '/admin/jobs?filter=In+Production',
          },
          {
            accent: 'teal',
            label: 'In QC',
            value: loading(inQc.length),
            delta: 'QC approved next',
            deltaDirection: 'up',
            icon: <CheckCircle2 aria-hidden />,
            href: '/admin/jobs?filter=In+QC',
          },
          {
            accent: 'green',
            label: 'Dispatched',
            value: loading(delivered.length),
            delta: 'Completed jobs',
            deltaDirection: 'up',
            icon: <Send aria-hidden />,
            href: '/admin/jobs?filter=Dispatched',
          },
        ]}
      />

      <div className="two-col">
        <div>
          <SectionHeader
            title={<span style={{ color: '#5eead4' }}>New Jobs</span>}
            action={<Link to="/admin/new-jobs">View All →</Link>}
          />
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-text-faint text-sm">Loading…</div>
          ) : (
            <JobTable jobs={newJobs} defaultView="grid" showActions minimalColumns />
          )}

          <div className="mt-6">
            <SectionHeader
              title={<span style={{ color: '#ff8a95' }}>New Quote Requests</span>}
              action={<Link to="/admin/new-quotes">View All →</Link>}
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-text-faint text-sm">Loading…</div>
            ) : (
              <JobTable jobs={newQuotes} defaultView="grid" showActions quoteView minimalColumns />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Job Split">
            <DonutChart
              centerValue={loading(totalActive)}
              centerLabel="Active"
              showCount
              slices={[
                { label: 'In Production', value: inProd.length, color: 'var(--color-amber)' },
                { label: 'In QC', value: inQc.length, color: 'var(--color-teal)' },
                { label: 'Sewout', value: inSewout.length, color: 'var(--color-purple, #a855f7)' },
              ]}
            />
          </Panel>

          <Panel title="Activity Trend">
            <BarChart items={weeklyTrend} />
          </Panel>

          <Panel title="Overview">
            <div className="flex flex-col gap-2">
              {[
                { label: 'Total Clients', value: loading(totalClients), to: '/admin/clients' },
                { label: 'Missed Deadlines', value: loading(missedDeadlines), to: '/admin/jobs' },
                {
                  label: 'On-Time Rate',
                  value: onTimeRate === null ? '—' : loading(`${onTimeRate}%`),
                  to: '/admin/jobs?filter=Dispatched',
                },
              ].map((row) => (
                <Link key={row.label} to={row.to} className="flex items-center justify-between group">
                  <span className="text-[12px] text-text-muted font-medium group-hover:text-text-main transition-colors">
                    {row.label}
                  </span>
                  <span className="text-[13px] font-bold text-text-main">{row.value}</span>
                </Link>
              ))}
            </div>
          </Panel>

          {expiringCards.length > 0 ? (
            <Callout tone={expiredCount > 0 ? 'crimson' : 'amber'}>
              {expiredCount > 0 && expiringSoonCount > 0
                ? `${expiredCount} client card${expiredCount === 1 ? '' : 's'} expired, ${expiringSoonCount} expiring within 30 days. `
                : expiredCount > 0
                  ? `${expiredCount} client card${expiredCount === 1 ? '' : 's'} already expired. `
                  : `${expiringSoonCount} client card${expiringSoonCount === 1 ? '' : 's'} expiring within 30 days. `}
              <Link to="/admin/clients" className="underline underline-offset-2">
                Review clients →
              </Link>
            </Callout>
          ) : newQuotesAll.length > 0 ? (
            <Callout tone="info">
              {newQuotesAll.length} quote request{newQuotesAll.length === 1 ? '' : 's'} awaiting review.
            </Callout>
          ) : null}
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
