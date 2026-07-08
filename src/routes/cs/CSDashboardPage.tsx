import { useMemo, useState } from 'react';
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
  DASH_METRICS,
  DASH_RANGES,
  type DashRange,
} from '@modules/shared-ui';
import { Inbox, Cog, CheckCircle2, Package } from 'lucide-react';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { isJobEtaExpired } from '@lib/utils';

export function CSDashboardPage() {
  const user = useSessionUser();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  const [range, setRange] = useState<DashRange>('This Month');
  const m = DASH_METRICS[range].cs;

  const { jobs: allJobs } = useAdminJobViews({ per_page: 100 });

  const newJobs = useMemo(
    () => allJobs.filter((j) => j.stage !== 'quote' && j.stage !== 'delivered' && j.status !== 'Ready to Deliver' && !isJobEtaExpired(j)).slice(0, 4),
    [allJobs],
  );
  const pendingQuotesAll = useMemo(
    () => allJobs.filter((j) => j.stage === 'quote' && j.status === 'Quote Submitted'),
    [allJobs],
  );
  const pendingQuotes = useMemo(() => pendingQuotesAll.slice(0, 4), [pendingQuotesAll]);

  // Mirrors the filters used on the pages these stat tiles link to, so the
  // dashboard numbers always agree with what the drill-down page shows.
  const inProduction = useMemo(
    () => allJobs.filter((j) => j.status === 'In Production'),
    [allJobs],
  );
  const readyToDispatch = useMemo(
    () => allJobs.filter((j) => j.status === 'Ready to Deliver' || isJobEtaExpired(j)),
    [allJobs],
  );
  const dispatched = useMemo(
    () => allJobs.filter((j) => j.stage === 'delivered' && j.status === 'Dispatched'),
    [allJobs],
  );

  // Order Split: bucket every job by its order type. "Digitizing + Sewout"
  // combo jobs count toward Digitizing, matching the convention used
  // elsewhere in the app (see EditJobModal's process-tab bucketing).
  const orderSplit = useMemo(() => {
    const art = allJobs.filter((j) => j.order === 'Artwork').length;
    const dig = allJobs.filter((j) => j.order === 'Digitizing' || j.order === 'Digitizing + Sewout').length;
    const sew = allJobs.filter((j) => j.order === 'Sewout').length;
    return { orders: art + dig + sew, art, dig, sew };
  }, [allJobs]);

  // Activity Trend: jobs created on each day of the current week (Mon–Sun).
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const job of allJobs) {
      const created = new Date(job.created);
      const dayIdx = Math.floor((created.getTime() - monday.getTime()) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < 7) counts[dayIdx]++;
    }

    const maxVal = Math.max(...counts, 1);
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
      label,
      value: counts[i],
      height: Math.max(Math.round((counts[i] / maxVal) * 100), 4),
      highlight: i === 6,
      color: i === 3 ? 'var(--color-navy-light)' : undefined,
    }));
  }, [allJobs]);

  return (
    <div className="page">
      <GreetingHero
        title={`Good ${getGreeting()}, ${firstName}`}
        subtitle="Here's what's happening across your production pipeline today."
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      <StatGrid
        stats={[
          {
            accent: 'crimson',
            label: 'Quote Pending',
            value: pendingQuotesAll.length,
            delta: m.sub1,
            deltaDirection: 'up',
            icon: <Inbox aria-hidden />,
            href: '/cs/new-quotes',
          },
          {
            accent: 'amber',
            label: 'In Production',
            value: inProduction.length,
            delta: m.sub2,
            icon: <Cog aria-hidden />,
            href: '/cs/projects?filter=In+Production',
          },
          {
            accent: 'teal',
            label: 'Ready to Dispatch',
            value: readyToDispatch.length,
            delta: m.sub3,
            deltaDirection: 'up',
            icon: <CheckCircle2 aria-hidden />,
            href: '/cs/deliver',
          },
          {
            accent: 'green',
            label: 'Dispatched',
            value: dispatched.length,
            delta: m.sub4,
            deltaDirection: 'up',
            icon: <Package aria-hidden />,
            href: '/cs/projects?filter=Dispatched',
          },
        ]}
      />

      <div className="two-col">
        <div>
          <SectionHeader
            title={<span style={{ color: '#5eead4' }}>New Jobs</span>}
            action={<Link to="/cs/new-jobs">View All →</Link>}
          />
          <JobTable jobs={newJobs} compact withControls={false} />

          <div className="mt-6">
            <SectionHeader
              title={<span style={{ color: '#ff8a95' }}>Quotes Pending Your Review</span>}
              action={<Link to="/cs/new-quotes">View All →</Link>}
            />
            <JobTable jobs={pendingQuotes} compact withControls={false} quoteView />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Order Split">
            <DonutChart
              centerValue={orderSplit.orders}
              centerLabel="Orders"
              showCount
              slices={[
                { label: 'Artwork', value: orderSplit.art, color: 'var(--color-navy-light)' },
                { label: 'Digitizing', value: orderSplit.dig, color: 'var(--color-crimson)' },
                { label: 'Sewout', value: orderSplit.sew, color: 'var(--color-amber)' },
              ]}
            />
          </Panel>

          <Panel title="Activity Trend">
            <BarChart items={weeklyTrend} />
          </Panel>

          {pendingQuotes.length > 0 ? (
            <Callout tone="info">
              {pendingQuotes.length} quote{pendingQuotes.length === 1 ? '' : 's'} awaiting your
              pricing review.
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

function RangeSelector({
  value,
  onChange,
}: {
  value: DashRange;
  onChange: (v: DashRange) => void;
}) {
  return (
    <select
      className="btn btn-outline"
      style={{ padding: '8px 12px', cursor: 'pointer' }}
      value={value}
      onChange={(e) => onChange(e.target.value as DashRange)}
      aria-label="Time range"
    >
      {DASH_RANGES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
