import { Callout, GreetingHero, JobTable, StatGrid, JOBS } from '@modules/shared-ui';

export function DesignerSubmittedPage() {
  // Mock: assume Senior Reddy submitted these.
  const inQc = JOBS.filter((j) => j.stage === 'qc');
  const inSewout = JOBS.filter((j) => j.stage === 'sewout');
  const delivered = JOBS.filter((j) => j.stage === 'delivered');

  return (
    <div className="page">
      <GreetingHero
        title="My Submitted Tasks"
        subtitle="Work you've submitted — current review stage, feedback notes, and downstream status."
      />

      <StatGrid
        stats={[
          { accent: 'purple', label: 'In QC Review', value: inQc.length },
          { accent: 'amber', label: 'In Sewout', value: inSewout.length },
          { accent: 'green', label: 'Dispatched (mo.)', value: delivered.length },
          { accent: 'blue', label: 'Avg. Rework', value: '1.2h' },
        ]}
      />

      <Callout tone="info">
        QC reviewers may return your submission with structured feedback. Returned files land back
        in your active tasks list.
      </Callout>

      <div className="mt-3">
        <JobTable jobs={inQc.concat(inSewout)} defaultView="grid" emptyLabel="Nothing in flight." />
      </div>
    </div>
  );
}
