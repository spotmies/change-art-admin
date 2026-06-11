import { useMemo } from 'react';
import { GreetingHero, JobTable, StatGrid, Callout, SectionHeader } from '@modules/shared-ui';
import { Inbox, Clock } from 'lucide-react';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;

export function CSNewQuotesPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });

  const pending = useMemo(
    () => allData.filter((j) => j.stage === 'quote' && j.status === 'Quote Submitted'),
    [allData],
  );
  const awaitingClient = useMemo(
    () => allData.filter((j) => j.stage === 'quote' && j.status === 'Quote Approved'),
    [allData],
  );

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="Quote Requests" subtitle="Incoming client quotes." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load quotes. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="Quote Requests"
        subtitle="Review incoming quotes, set your agency price, and send to the client for confirmation."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <StatGrid
          stats={[
            {
              accent: 'crimson',
              label: 'Awaiting Your Review',
              value: isLoading ? '…' : pending.length,
              delta: 'Open your price & send to client',
              deltaDirection: 'down',
              icon: <Inbox aria-hidden />,
            },
          ]}
        />
        <StatGrid
          stats={[
            {
              accent: 'amber',
              label: 'Awaiting Client Confirm',
              value: isLoading ? '…' : awaitingClient.length,
              delta: 'Price sent — client to confirm',
              icon: <Clock aria-hidden />,
            },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">Loading quotes…</div>
      ) : (
        <>
          {pending.length > 0 ? (
            <>
              <SectionHeader title="Pending Your Review & Pricing" />
              <Callout tone="info">
                Click a job to open it, review the brief and files, then set your agency price and
                send it to the client.
              </Callout>
              <div className="mt-3">
                <JobTable jobs={pending} showActions defaultView="table" />
              </div>
            </>
          ) : (
            <Callout tone="green">All caught up — no quotes pending review.</Callout>
          )}

          {awaitingClient.length > 0 && (
            <div className="mt-6">
              <SectionHeader
                title={<span style={{ color: '#fcd34d' }}>Price Sent — Awaiting Client Confirmation</span>}
              />
              <JobTable jobs={awaitingClient} showActions defaultView="table" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
