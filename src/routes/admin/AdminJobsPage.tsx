import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GreetingHero,
  JobDetailModal,
  EditJobModal,
  JobFilterBar,
  JobTable,
  Pagination,
  applyJobFilters,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  type JobFilters,
  type Job,
} from '@modules/shared-ui';
import { useAdminJobViews, useAdminJobById } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';

const PER_PAGE = 20;

/** Reads `?open=<uuid>` from the URL and opens that job's detail modal directly. */
function DeepLinkModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open') ?? '';
  const { data: job } = useAdminJobById(openId);
  const [editJob, setEditJob] = useState<Job | null>(null);

  return (
    <>
      <JobDetailModal
        job={openId && job ? job : null}
        onClose={() => setSearchParams((p) => { p.delete('open'); return p; })}
        onEdit={(j) => setEditJob(j)}
        onAssign={() => setSearchParams((p) => { p.delete('open'); return p; })}
      />
      {editJob && (
        <EditJobModal
          job={editJob}
          onClose={() => setEditJob(null)}
          onBack={() => setEditJob(null)}
        />
      )}
    </>
  );
}

export function AdminJobsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);

  const { jobs: rawJobs, total, isLoading, isError } = useAdminJobViews({ page, per_page: PER_PAGE });
  const clientsQuery = useAdminClients();
  const clients = clientsQuery.data?.items ?? [];

  const totalPages = Math.ceil((total || 0) / PER_PAGE);

  // Quote-stage rows belong to the Quotes page — keep All Jobs disjoint.
  const jobs = useMemo(() => rawJobs.filter((j) => j.stage !== 'quote'), [rawJobs]);

  // Apply all filter bar criteria client-side on the current page.
  const filtered = useMemo(() => applyJobFilters(jobs, filters), [jobs, filters]);

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    setPage(1);
  }

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title="All Jobs" subtitle="Every job across the platform." />
        <div className="flex items-center justify-center py-16 text-[var(--crimson)] text-sm">
          Failed to load jobs. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title="All Jobs"
        subtitle={`Every job across the platform — search, filter by type, priority, client, or date.${total > 0 ? ` ${total} total.` : ''}`}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading jobs…
        </div>
      ) : (
        <>
          <JobTable
            jobs={filtered}
            showActions
            defaultView="grid"
            toolbarSlot={
              <JobFilterBar
                filters={filters}
                onChange={handleFiltersChange}
                statusOptions={JOB_STATUS_OPTIONS}
                clients={clients}
              />
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
      <DeepLinkModal />
    </div>
  );
}
