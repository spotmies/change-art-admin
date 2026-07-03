import { GreetingHero, JobTable, StatGrid, JOBS } from '@modules/shared-ui';

export function DigitatorSubmittedPage() {
  const digitizing = JOBS.filter(
    (j) => j.order === 'Digitizing' || j.order === 'Digitizing + Sewout',
  );
  const inSewout = digitizing.filter((j) => j.stage === 'sewout');
  const inQc = digitizing.filter((j) => j.stage === 'qc');
  const delivered = digitizing.filter((j) => j.stage === 'delivered');

  return (
    <div className="page">
      <GreetingHero
        title="Submitted Digitizing"
        subtitle="Files you've cut — under sewout, in QC, or returned for adjustment."
      />

      <StatGrid
        stats={[
          { accent: 'amber', label: 'In Sewout', value: inSewout.length },
          { accent: 'purple', label: 'In QC', value: inQc.length },
          { accent: 'green', label: 'Dispatched (mo.)', value: delivered.length },
          { accent: 'crimson', label: 'Returned (wk.)', value: 0 },
        ]}
      />

      <JobTable
        jobs={inSewout.concat(inQc).concat(delivered)}
        defaultView="grid"
        emptyLabel="Nothing submitted yet."
      />
    </div>
  );
}
