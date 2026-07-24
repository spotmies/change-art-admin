import { Callout, GreetingHero, JobTable, StatGrid } from '@modules/shared-ui';
import { useAdminJobViews } from '@modules/admin-panel/hooks/use-admin-jobs';

export function SewoutHistoryPage() {
  const { jobs, isLoading } = useAdminJobViews({ per_page: 100 });
  const submitted = jobs.filter((j) => j.rawStatus === 'SUBMITTED_TO_QC' || j.rawStatus === 'QC_REVIEW');

  return (
    <div className="page">
      <GreetingHero
        title="Sewout History"
        subtitle="Sewouts you've submitted to QC."
      />

      <StatGrid stats={[{ accent: 'purple', label: 'Awaiting QC', value: submitted.length }]} />

      <Callout tone="info">
        Once QC approves a job it locks and leaves your active queue — this view shows what's still
        in flight, not the full historical archive.
      </Callout>

      <JobTable jobs={submitted} defaultView="table" emptyLabel={isLoading ? 'Loading…' : 'No history yet.'} />
    </div>
  );
}
