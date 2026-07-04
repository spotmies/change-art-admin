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
  const pendingQuotes = useMemo(
    () => allJobs.filter((j) => j.stage === 'quote' && j.status === 'Quote Submitted').slice(0, 4),
    [allJobs],
  );

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
            value: m.pending,
            delta: m.sub1,
            deltaDirection: 'up',
            icon: <Inbox aria-hidden />,
            href: '/cs/new-quotes',
          },
          {
            accent: 'amber',
            label: 'In Production',
            value: m.inProd,
            delta: m.sub2,
            icon: <Cog aria-hidden />,
            href: '/cs/projects?filter=In+Production',
          },
          {
            accent: 'teal',
            label: 'Ready to Dispatch',
            value: m.ready,
            delta: m.sub3,
            deltaDirection: 'up',
            icon: <CheckCircle2 aria-hidden />,
            href: '/cs/deliver',
          },
          {
            accent: 'green',
            label: 'Dispatched',
            value: m.delivered,
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
            <JobTable jobs={pendingQuotes} compact withControls={false} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Order Split">
            <DonutChart
              centerValue={m.orderSplit.orders}
              centerLabel="Orders"
              slices={[
                { label: 'Artwork', value: m.orderSplit.art, color: 'var(--color-navy-light)' },
                { label: 'Digitizing', value: m.orderSplit.dig, color: 'var(--color-crimson)' },
                { label: 'Sewout', value: m.orderSplit.sew, color: 'var(--color-amber)' },
              ]}
            />
          </Panel>

          <Panel title="Activity Trend">
            <BarChart
              items={m.trend.map((t, i) => ({
                label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i] ?? `D${i + 1}`,
                value: t.v,
                height: t.h,
                highlight: i === 4,
                color: i === 3 ? 'var(--color-navy-light)' : undefined,
              }))}
            />
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
