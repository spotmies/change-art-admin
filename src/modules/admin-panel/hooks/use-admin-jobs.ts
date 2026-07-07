import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { UserRole, FileScanStatus, type IFileVersion } from '@contracts';
import { queryKeys } from '@lib/query-keys';
import type { Job } from '@modules/shared-ui';
import {
  adminService,
  type JobCardFilters,
  type UpdateJobCardBody,
  type UserFilters,
} from '../services/admin.service';
import { adaptJobCard } from '../adapters/job-view';

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

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) => adminService.resetUserPassword(id),
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

  const job = useMemo(() => {
    if (!jobQuery.data) return null;
    return adaptJobCard(jobQuery.data, new Map(), new Map());
  }, [jobQuery.data]);

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

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|tiff?|heic|heif|ico)$/i;

export function isAdminViewableImage(file: IFileVersion): boolean {
  const looksLikeImage =
    file.file_type.startsWith('image/') || IMAGE_EXT_RE.test(file.file_name);
  return (
    looksLikeImage &&
    file.scan_status !== FileScanStatus.INFECTED &&
    file.scan_status !== FileScanStatus.SCAN_FAILED
  );
}

export function useAdminJobFiles(jobUuid?: string | null) {
  return useQuery({
    queryKey: ['admin', 'files', 'forJob', jobUuid ?? 'none'],
    queryFn: ({ signal }) => adminService.listFilesForJob(jobUuid as string, signal),
    enabled: Boolean(jobUuid),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useAdminJobImageUrls(jobUuid: string | null | undefined, imageFiles: IFileVersion[]) {
  const ids = imageFiles.map((f) => f.id);
  return useQuery({
    queryKey: ['admin', 'files', 'image-urls', jobUuid ?? 'none', ids],
    queryFn: async () => {
      const results = await Promise.all(imageFiles.map((f) => adminService.getDownloadUrl(f.id)));
      return results.map((r) => r.url);
    },
    enabled: Boolean(jobUuid) && ids.length > 0,
    staleTime: 10 * 60_000,
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
  // Client names are now embedded in each job card via a backend LEFT JOIN —
  // no separate clients fetch is needed for name resolution.
  const jobsQuery = useAdminJobCards(filters);

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
    return jobsQuery.data.items.map((card) => {
      const job = adaptJobCard(card, new Map(), new Map());
      const url = thumbs[card.id];
      if (url) job.images = [url];
      return job;
    });
  }, [jobsQuery.data, thumbnailsQuery.data]);

  return {
    jobs,
    total: jobsQuery.data?.meta.total ?? 0,
    isLoading: jobsQuery.isLoading,
    isError: jobsQuery.isError,
    error: jobsQuery.error,
  };
}
