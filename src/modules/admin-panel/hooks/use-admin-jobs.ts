import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { UserRole } from '@contracts';
import { queryKeys } from '@lib/query-keys';
import type { Job } from '@modules/shared-ui';
import {
  adminService,
  type JobCardFilters,
  type UpdateJobCardBody,
  type UserFilters,
} from '../services/admin.service';
import { adaptJobCard, type ClientInfo } from '../adapters/job-view';
import { useAdminClients } from './use-admin-clients';

// Exported so pages that explicitly need user name resolution can opt in.
// CLIENT accounts are excluded by default — User Management only covers
// internal staff; client records live in the Clients tab.
export function useAdminUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: queryKeys.users.list({ exclude_role: UserRole.CLIENT, ...filters } as Record<string, unknown>),
    queryFn: () => adminService.getUsers({ exclude_role: UserRole.CLIENT, ...filters }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminJobCards(filters: JobCardFilters = {}) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters as Record<string, unknown>),
    queryFn: () => adminService.getJobCards(filters),
    // 30-second stale window prevents job-cards from re-fetching on every
    // navigation while still keeping the list reasonably fresh.
    staleTime: 30 * 1000,
  });
}

/**
 * Persist edits to a Job Card (Edit modal "Save Changes"). On success the
 * whole jobs cache is invalidated so every list/grid view reflects the change.
 */
export function useUpdateJobCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateJobCardBody }) =>
      adminService.updateJobCard(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    },
  });
}

export function useAdminJobById(id: string) {
  const jobQuery = useQuery({
    queryKey: queryKeys.jobs.byId(id),
    queryFn: () => adminService.getJobCard(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
  const clientsQuery = useAdminClients();

  const clientsMap = useMemo(() => {
    const map = new Map<string, ClientInfo>();
    for (const c of clientsQuery.data?.items ?? []) {
      map.set(c.id, { name: c.company_name ?? c.client_name, clientId: c.client_id });
    }
    return map;
  }, [clientsQuery.data]);

  const job = useMemo(() => {
    if (!jobQuery.data) return null;
    return adaptJobCard(jobQuery.data, clientsMap, new Map());
  }, [jobQuery.data, clientsMap]);

  return { data: job, isLoading: jobQuery.isLoading, isError: jobQuery.isError };
}

/**
 * Admin/CS only: promote a DRAFT job card (from email inbox) to JOB_PLACED.
 * Invalidates the full jobs cache so New Jobs list reflects the change immediately.
 */
export function useActivateJobCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.activateJobCard(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    },
  });
}

/**
 * Fetch a fresh presigned thumbnail URL for a single job when the detail modal
 * opens. staleTime:0 bypasses the 60-second batch-thumbnail cache, so email
 * attachments appear immediately even if the cache pre-dates the file upload.
 */
export function useJobThumbnail(jobId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.files.thumbnails(jobId ? [jobId] : []),
    queryFn: () => adminService.getJobThumbnails([jobId!]),
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Fetches the admin copy for an original job. Returns null when none exists yet.
 */
export function useAdminCopy(originalJobId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.jobs.adminCopy(originalJobId ?? ''),
    queryFn: () => adminService.getAdminCopy(originalJobId!),
    enabled: !!originalJobId,
    staleTime: 30 * 1000,
  });
}

/**
 * Creates (or updates) the admin copy for an original job.
 * Invalidates the full jobs cache on success so the list refreshes.
 */
export function useCreateAdminCopy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      originalJobId,
      body,
    }: {
      originalJobId: string;
      body: Omit<UpdateJobCardBody, 'version'>;
    }) => adminService.createAdminCopy(originalJobId, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.jobs.adminCopy(vars.originalJobId) });
    },
  });
}

export function useAdminJobViews(filters: JobCardFilters = {}): {
  jobs: Job[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  // Two queries only — job-cards (primary) + clients (client name resolution).
  // Users are NOT eagerly fetched here; assignedTo falls back to null which
  // the UI renders as "Pending". Pages that need user names call useAdminUsers.
  const jobsQuery = useAdminJobCards(filters);
  const clientsQuery = useAdminClients();

  const clientsMap = useMemo(() => {
    const map = new Map<string, ClientInfo>();
    for (const c of clientsQuery.data?.items ?? []) {
      map.set(c.id, {
        name: c.company_name ?? c.client_name,
        clientId: c.client_id,
      });
    }
    return map;
  }, [clientsQuery.data]);

  // Preview thumbnails are resolved separately from job-cards: the job-card
  // payload carries no image, so we batch-fetch one presigned thumbnail per
  // job (keyed by the job-card UUID) in a single round-trip and merge it in.
  const jobUuids = useMemo(
    () => (jobsQuery.data?.items ?? []).map((c) => c.id),
    [jobsQuery.data],
  );

  const thumbnailsQuery = useQuery({
    queryKey: queryKeys.files.thumbnails(jobUuids),
    queryFn: () => adminService.getJobThumbnails(jobUuids),
    enabled: jobUuids.length > 0,
    staleTime: 60 * 1000,
  });

  const jobs = useMemo<Job[]>(() => {
    if (!jobsQuery.data) return [];
    const thumbs = thumbnailsQuery.data ?? {};
    // Pass empty usersMap — assignedTo resolves to null → shown as "Pending".
    return jobsQuery.data.items.map((card) => {
      const job = adaptJobCard(card, clientsMap, new Map());
      const url = thumbs[card.id];
      // Backend returns a single thumbnail per job. Store it as a single-entry
      // array so the modal's carousel renders one tile (instead of duplicating
      // the same preview into multiple carousel slots).
      if (url) job.images = [url];
      return job;
    });
  }, [jobsQuery.data, clientsMap, thumbnailsQuery.data]);

  return {
    jobs,
    total: jobsQuery.data?.meta.total ?? 0,
    isLoading: jobsQuery.isLoading,
    isError: jobsQuery.isError,
    error: jobsQuery.error,
  };
}
