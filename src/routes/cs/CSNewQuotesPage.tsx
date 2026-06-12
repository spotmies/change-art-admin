import { useMemo, useState } from 'react';
import {
  GreetingHero,
  JobTable,
  Pagination,
  StatGrid,
  SectionHeader,
  Callout,
} from '@modules/shared-ui';
import { Inbox, Clock, Palette, Cpu } from 'lucide-react';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;

export function CSNewQuotesPage() {
  const { jobs: allData, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  const [pendingPage,   setPendingPage]   = useState(1);
  const [awaitingPage,  setAwaitingPage]  = useState(1);

  const quoteJobs     = useMemo(() => allData.filter((j) => j.stage === 'quote'), [allData]);
  const pending       = useMemo(() => quoteJobs.filter((j) => j.status === 'Quote Submitted'), [quoteJobs]);
  const awaitingClient = useMemo(() => quoteJobs.filter((j) => j.status === 'Quote Approved'), [quoteJobs]);
  const artworkJobs   = useMemo(() => quoteJobs.filter((j) => j.order === 'Artwork'), [quoteJobs]);
  const digitJobs     = useMemo(() => quoteJobs.filter((j) => j.order !== 'Artwork'), [quoteJobs]);

  const pendingPages  = Math.max(1, Math.ceil(pending.length / PER_PAGE));
  const awaitingPages = Math.max(1, Math.ceil(awaitingClient.length / PER_PAGE));

  const pendingItems  = useMemo(
    () => pending.slice((pendingPage  - 1) * PER_PAGE, pendingPage  * PER_PAGE),
    [pending, pendingPage],
  );
  const awaitingItems = useMemo(
    () => awaitingClient.slice((awaitingPage - 1) * PER_PAGE, awaitingPage * PER_PAGE),
    [awaitingClient, awaitingPage],
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

      <StatGrid
        stats={[
          {
            accent: 'crimson',
            label: 'Awaiting Your Review',
            value: isLoading ? '…' : pending.length,
            delta: 'Open & price each job',
            deltaDirection: 'down',
            icon: <Inbox aria-hidden />,
          },
          {
            accent: 'amber',
            label: 'Awaiting Client Confirm',
            value: isLoading ? '…' : awaitingClient.length,
            delta: 'Price sent — pending client',
            icon: <Clock aria-hidden />,
          },
          {
            accent: 'blue',
            label: 'Artwork',
            value: isLoading ? '…' : artworkJobs.length,
            icon: <Palette aria-hidden />,
          },
          {
            accent: 'teal',
            label: 'Digitizing / Other',
            value: isLoading ? '…' : digitJobs.length,
            icon: <Cpu aria-hidden />,
          },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading quotes…
        </div>
      ) : (
        <>
          {pending.length > 0 ? (
            <div className="mt-1">
              <SectionHeader title="Pending Your Review & Pricing" />
              <Callout tone="info">
                Click a job to open it, review the brief and files, then set your agency price and
                send it to the client.
              </Callout>
              <div className="mt-3">
                <JobTable jobs={pendingItems} showActions quoteView defaultView="grid" />
              </div>
              <Pagination
                page={pendingPage}
                totalPages={pendingPages}
                total={pending.length}
                perPage={PER_PAGE}
                onPageChange={setPendingPage}
              />
            </div>
          ) : (
            <Callout tone="green">All caught up — no quotes pending review.</Callout>
          )}

          {awaitingClient.length > 0 && (
            <div className="mt-6">
              <SectionHeader title="Price Sent — Awaiting Client Confirmation" />
              <div className="mt-3">
                <JobTable jobs={awaitingItems} showActions quoteView defaultView="grid" />
              </div>
              <Pagination
                page={awaitingPage}
                totalPages={awaitingPages}
                total={awaitingClient.length}
                perPage={PER_PAGE}
                onPageChange={setAwaitingPage}
              />
            </div>
          )}

          {pending.length === 0 && awaitingClient.length === 0 && (
            <div className="flex items-center justify-center py-16 text-text-faint text-sm">
              No pending quote requests right now.
            </div>
          )}
        </>
      )}
    </div>
  );
}
