import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GreetingHero,
  JobFilterBar,
  JobTable,
  Pagination,
  StatGrid,
  EMPTY_FILTERS,
  JOB_STATUS_OPTIONS,
  applyJobFilters,
  type JobFilters,
} from '@modules/shared-ui';
import { useAdminJobViews } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { useAdminClients } from '../../modules/admin-panel/hooks/use-admin-clients';
import { isPipelineActive, isQuoteAwaitingClient } from '../../modules/admin-panel/adapters/job-view';
import { isJobEtaExpired, getDateRangeFromPreset } from '@lib/utils';

const FETCH_SIZE = 200;
const PER_PAGE   = 20;
const VALID_STATUS_VALUES = new Set(JOB_STATUS_OPTIONS.map((o) => o.value));
const VALID_PROJECT_VALUES = new Set(['Live', 'Quote', 'Amend', 'Live Quote']);

export function CSProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openJobId = searchParams.get('open');
  // Pre-seed a status filter from ?filter= (used by the CS dashboard stat cards).
  // Validate against the known option list to reject junk/unmapped values.
  const rawFilterParam = searchParams.get('filter') ?? '';
  const filterParam = VALID_STATUS_VALUES.has(rawFilterParam) ? rawFilterParam : '';
  // Pre-seed a project-type filter from ?project= (used by the sidebar's
  // Live / Live Quote / Quote / Amend nav items).
  const rawProjectParam = searchParams.get('project') ?? '';
  const projectParam = VALID_PROJECT_VALUES.has(rawProjectParam) ? rawProjectParam : '';
  const { jobs: allJobs, isLoading, isError } = useAdminJobViews({ per_page: FETCH_SIZE });
  // Project-type nav filters (Live / Live Quote / Quote / Amend) apply a
  // status boundary on top of the raw project tag so a card only shows up
  // once it's actually reached that stage of the pipeline:
  // - Live / Live Quote: hidden while still 'Pending' (ETA not sent yet)
  //   and once dispatched (done, not "live").
  // - Quote: priced quotes awaiting client confirmation (QUOTE_APPROVED),
  //   PLUS quotes the client already confirmed but still awaiting an ETA
  //   from staff — those cards are already tagged `project: 'Live Quote'`
  //   (not 'Quote'), so this bucket can't be gated by an exact project
  //   match like the others; isQuoteAwaitingClient checks status directly.
  // - Amend: project === 'Amend' is already a single, terminal-ish status
  //   (MODIFICATION_REQUESTED), no extra boundary needed.
  const allData = useMemo(() => {
    if (!projectParam) return allJobs;
    if (projectParam === 'Quote') return allJobs.filter(isQuoteAwaitingClient);
    return allJobs.filter((j) => {
      if (j.project !== projectParam) return false;
      if (projectParam === 'Live' || projectParam === 'Live Quote') return isPipelineActive(j);
      return true;
    });
  }, [allJobs, projectParam]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>(() => {
    const rawClientId = searchParams.get('clientId') || searchParams.get('client_id') || '';
    let rawDateFrom = searchParams.get('dateFrom') || '';
    let rawDateTo = searchParams.get('dateTo') || '';
    const rawRange = searchParams.get('range') || '';

    if (rawRange && !rawDateFrom) {
      const computed = getDateRangeFromPreset(rawRange);
      rawDateFrom = computed.dateFrom;
      rawDateTo = computed.dateTo;
    }

    return {
      ...EMPTY_FILTERS,
      status: filterParam,
      clientId: rawClientId,
      dateFrom: rawDateFrom,
      dateTo: rawDateTo,
    };
  });

  // per_page: 500 — needed to populate the client filter dropdown with all client names.
  const clientsQuery = useAdminClients({ per_page: 500 });
  const clients = clientsQuery.data?.items ?? [];

  // Keep the filter bar in sync if URL search params change
  useEffect(() => {
    const rawClientId = searchParams.get('clientId') || searchParams.get('client_id') || '';
    let rawDateFrom = searchParams.get('dateFrom') || '';
    let rawDateTo = searchParams.get('dateTo') || '';
    const rawRange = searchParams.get('range') || '';

    if (rawRange && !rawDateFrom) {
      const computed = getDateRangeFromPreset(rawRange);
      rawDateFrom = computed.dateFrom;
      rawDateTo = computed.dateTo;
    }

    setFilters((prev) => {
      const targetStatus = filterParam || prev.status;
      if (
        prev.status === targetStatus &&
        prev.clientId === rawClientId &&
        prev.dateFrom === rawDateFrom &&
        prev.dateTo === rawDateTo
      ) {
        return prev;
      }
      return {
        ...prev,
        status: targetStatus,
        clientId: rawClientId,
        dateFrom: rawDateFrom,
        dateTo: rawDateTo,
      };
    });
  }, [filterParam, searchParams]);

  const open       = useMemo(() => allData.filter((j) => j.stage !== 'delivered' && !isJobEtaExpired(j)), [allData]);
  const ready      = useMemo(
    () =>
      allData
        .filter((j) => (j.status === 'Ready to Deliver' || isJobEtaExpired(j)) && j.status !== 'On Hold')
        .map((j) =>
          isJobEtaExpired(j) && j.status !== 'Dispatched'
            ? { ...j, status: 'Ready to Deliver' as const, stage: 'delivered' as const }
            : j
        ),
    [allData],
  );
  const amend      = useMemo(() => allData.filter((j) => j.project === 'Amend'), [allData]);

  const filteredData = useMemo(() => applyJobFilters(allData, filters, clients), [allData, filters, clients]);

  // Reset to page 1 whenever the active filters change.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PER_PAGE));
  const pageItems  = useMemo(
    () => filteredData.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredData, page],
  );

  function handleFiltersChange(next: JobFilters) {
    setFilters(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next.status !== filterParam) {
      nextParams.delete('filter');
    }
    if (!next.clientId) {
      nextParams.delete('clientId');
      nextParams.delete('client_id');
    } else {
      nextParams.set('clientId', next.clientId);
    }
    if (!next.dateFrom) {
      nextParams.delete('dateFrom');
      nextParams.delete('range');
    } else {
      nextParams.set('dateFrom', next.dateFrom);
    }
    if (!next.dateTo) {
      nextParams.delete('dateTo');
    } else {
      nextParams.set('dateTo', next.dateTo);
    }
    setSearchParams(nextParams, { replace: true });
  }

  const isAllProjects = !projectParam && !filterParam;
  const activeFilterLabel = filterParam || projectParam;

  const sectionTitle = useMemo(() => {
    if (projectParam === 'Live') return 'Live (Direct) Projects';
    if (projectParam === 'Live Quote') return 'Live Quote Projects';
    if (projectParam === 'Quote') return 'Quote Projects';
    if (projectParam === 'Amend') return 'Amend Projects';
    if (filterParam === 'In Production') return 'In Production Projects';
    if (filterParam) return `${filterParam} Projects`;
    if (projectParam) return `${projectParam} Projects`;
    return 'All Projects';
  }, [projectParam, filterParam]);

  const activeClient = useMemo(() => {
    if (!filters.clientId) return null;
    return clients.find((c) => c.client_id === filters.clientId || c.id === filters.clientId);
  }, [filters.clientId, clients]);

  const activeFilterSubtitle = useMemo(() => {
    const clientName = activeClient ? (activeClient.company_name || activeClient.client_name) : null;
    const rangeLabel = searchParams.get('range');
    const dateRangeStr = rangeLabel || (filters.dateFrom ? `${filters.dateFrom} to ${filters.dateTo || 'Today'}` : null);

    if (clientName && dateRangeStr) {
      return `Showing jobs for ${clientName} (${dateRangeStr})`;
    } else if (clientName) {
      return `Showing jobs for ${clientName}`;
    } else if (activeFilterLabel) {
      return `Showing ${activeFilterLabel.toLowerCase()} jobs.`;
    }
    return 'Browse every active, delivered, and amendment job across the Client Servicing pipeline.';
  }, [activeClient, filters.dateFrom, filters.dateTo, searchParams, activeFilterLabel]);

  if (isError) {
    return (
      <div className="page">
        <GreetingHero title={sectionTitle} subtitle="All jobs across the Client Servicing pipeline." />
        <div className="flex items-center justify-center py-16 text-[var(--color-crimson)] text-sm">
          Failed to load projects. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <GreetingHero
        title={sectionTitle}
        subtitle={activeFilterSubtitle}
      />

      <StatGrid
        stats={[
          { accent: 'blue',   label: 'Total Projects',   value: isLoading ? '…' : allData.length },
          { accent: 'amber',  label: 'Open',             value: isLoading ? '…' : open.length    },
          { accent: 'teal',   label: 'Ready to Dispatch', value: isLoading ? '…' : ready.length   },
          { accent: 'purple', label: 'Amendments',       value: isLoading ? '…' : amend.length   },
        ]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-text-faint text-sm">
          Loading projects…
        </div>
      ) : filteredData.length === 0 ? (
        <>
          {isAllProjects && (
            <JobFilterBar
              filters={filters}
              onChange={handleFiltersChange}
              statusOptions={JOB_STATUS_OPTIONS}
              clients={clients}
            />
          )}
          <div className="flex items-center justify-center py-16 text-text-faint text-sm">
            {activeFilterLabel ? `No ${activeFilterLabel.toLowerCase()} jobs.` : 'No projects match these filters.'}
          </div>
        </>
      ) : (
        <>
          <JobTable
            jobs={pageItems}
            showActions
            defaultView="grid"
            initialOpenJobId={openJobId}
            onInitialOpenHandled={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('open');
              setSearchParams(next, { replace: true });
            }}
            toolbarSlot={
              isAllProjects ? (
                <JobFilterBar
                  filters={filters}
                  onChange={handleFiltersChange}
                  statusOptions={JOB_STATUS_OPTIONS}
                  clients={clients}
                />
              ) : undefined
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredData.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
