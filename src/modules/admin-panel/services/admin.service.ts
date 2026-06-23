import { apiClient } from '@lib/api-client';
import type { IClient, IFileVersion, IIngestedEmail, IJobCard, IUser, PaginatedList } from '@contracts';

// ─── Client profile change requests (admin review queue) ──────────────────
// Local to this module — not in @contracts because the backend enum mirror
// hasn't been pulled across yet. See PROFILE_CHANGE_REQUEST_API.md.

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProfileChangeRequest {
  id: string;
  tenant_id: string;
  client_id: string;
  requested_by_user_id: string | null;
  status: ChangeRequestStatus;
  changes: Partial<{
    client_name: string;
    company_name: string | null;
    contact_name: string;
    contact_number: string;
    location: string | null;
    address: string | null;
  }>;
  review_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  client: {
    client_id: string;
    client_name: string;
    company_name: string | null;
  } | null;
}

export interface ProfileChangeRequestFilters {
  status?: ChangeRequestStatus;
  page?: number;
  per_page?: number;
}

export interface JobCardFilters {
  status?: string;
  order_type?: string;
  project_type?: string;
  client_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
  priority?: string;
  date_from?: string;
  date_to?: string;
  stage?: string;
  pipeline?: string;
  exclude_stage?: string;
}

export interface ClientFilters {
  search?: string;
  page?: number;
  per_page?: number;
}

export interface UserFilters {
  role?: string;
  exclude_role?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface CreateClientBody {
  client_name: string;
  contact_name: string;
  contact_number: string;
  email: string;
  company_name?: string;
  location?: string;
  country?: string;
  currency?: string;
}

export interface ProvisionClientBody {
  client_name: string;
  contact_name: string;
  contact_number: string;
  email: string;
  password: string;
  company_name?: string;
  location?: string;
  country?: string;
  currency?: string;
}

export interface UpdateClientBody {
  client_name?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  email?: string;
  location?: string;
  payment_mode?: string;
}

/**
 * Editable Job Card fields. `version` is mandatory — the backend uses it for
 * optimistic-lock concurrency (PATCH returns 409 on mismatch). Everything else
 * is a partial; only send the fields that actually changed. Note: `status` and
 * pricing are NOT editable here — status is workflow-driven and prices go
 * through the CS quote endpoints.
 */
export interface UpdateJobCardBody {
  version: number;
  design_name?: string;
  order_type?: string;
  process_type?: string;
  design_complexity?: string;
  priority?: string;
  eta_hours?: number;
  num_colors?: number;
  notes?: string;
  specific_type?: string;
  final_files?: string[];
  placement?: string;
  width_inches?: number;
  height_inches?: number;
  fabric?: string;
}

export interface CreateJobCardBody {
  client_id: string;
  mail: string;
  order_type: string;
  project_type: string;
  design_name: string;
  eta_hours?: number;
  priority?: string;
  process_type?: string;
  final_files?: string[];
  placement?: string;
  width_inches?: number;
  height_inches?: number;
  num_colors?: number;
  fabric?: string;
  sewout_required?: boolean;
  description?: string;
  billing_address?: string;
  shipping_address?: string;
  client_po?: string;
}

export interface SendQuotePriceBody {
  amount: number;
  currency?: string;
  note?: string;
}

export interface CreateUserBody {
  email: string;
  name: string;
  password: string;
  role: string;
  sub_type?: string | null;
}

export interface UpdateUserBody {
  name?: string;
  role?: string;
  sub_type?: string | null;
  is_active?: boolean;
}

export const adminService = {
  getJobCards(filters: JobCardFilters = {}): Promise<PaginatedList<IJobCard>> {
    return apiClient.getPaginated<IJobCard>('/api/v1/job-cards', {
      params: { per_page: 100, ...filters } as Record<string, unknown>,
    });
  },

  getJobBadges(): Promise<Record<string, number>> {
    return apiClient.get<Record<string, number>>('/api/v1/job-cards/badges');
  },

  getJobCard(id: string): Promise<IJobCard> {
    return apiClient.get<IJobCard>(`/api/v1/job-cards/${id}`);
  },

  /**
   * Batch-resolve one presigned thumbnail URL per job in a single round-trip.
   * Keyed by job-card UUID (`IJobCard.id`), NOT the human `job_id`. Returns a
   * `{ uuid: url | null }` map (null = job has no viewable image).
   */
  getJobThumbnails(jobIds: string[]): Promise<Record<string, string | null>> {
    if (jobIds.length === 0) return Promise.resolve({});
    return apiClient.post<Record<string, string | null>, { job_ids: string[] }>(
      '/api/v1/files/thumbnails',
      { job_ids: jobIds },
    );
  },

  listFilesForJob(jobCardId: string, signal?: AbortSignal): Promise<IFileVersion[]> {
    return apiClient.get<IFileVersion[]>(`/api/v1/files/job/${jobCardId}`, { signal });
  },

  getDownloadUrl(fileId: string): Promise<{ url: string; file: IFileVersion }> {
    return apiClient.get<{ url: string; file: IFileVersion }>(`/api/v1/files/${fileId}/download-url`);
  },

  updateJobCard(id: string, body: UpdateJobCardBody): Promise<IJobCard> {
    return apiClient.patch<IJobCard, UpdateJobCardBody>(`/api/v1/job-cards/${id}`, body);
  },

  /** Returns the admin copy for an original job, or null if none exists yet. */
  getAdminCopy(originalJobId: string): Promise<IJobCard | null> {
    return apiClient.get<IJobCard | null>(`/api/v1/job-cards/${originalJobId}/admin-copy`);
  },

  /** Creates (or updates if already exists) the admin copy for an original job. */
  createAdminCopy(originalJobId: string, body: Omit<UpdateJobCardBody, 'version'>): Promise<IJobCard> {
    return apiClient.post<IJobCard, Omit<UpdateJobCardBody, 'version'>>(
      `/api/v1/job-cards/${originalJobId}/admin-copy`,
      body,
    );
  },

  getClients(filters: ClientFilters = {}): Promise<PaginatedList<IClient>> {
    return apiClient.getPaginated<IClient>('/api/v1/clients', {
      params: { ...filters } as Record<string, unknown>,
    });
  },

  createClient(body: CreateClientBody): Promise<IClient> {
    return apiClient.post<IClient, CreateClientBody>('/api/v1/clients', body);
  },

  provisionClient(body: ProvisionClientBody): Promise<IClient> {
    return apiClient.post<IClient, ProvisionClientBody>('/api/v1/clients/provision', body);
  },

  updateClient(id: string, body: UpdateClientBody): Promise<IClient> {
    return apiClient.patch<IClient, UpdateClientBody>(`/api/v1/clients/${id}`, body);
  },

  deleteClient(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/clients/${id}`);
  },

  getUsers(filters: UserFilters = {}): Promise<PaginatedList<IUser>> {
    return apiClient.getPaginated<IUser>('/api/v1/users', {
      params: { ...filters } as Record<string, unknown>,
    });
  },

  createUser(body: CreateUserBody): Promise<IUser> {
    return apiClient.post<IUser, CreateUserBody>('/api/v1/users', body);
  },

  updateUser(id: string, body: UpdateUserBody): Promise<IUser> {
    return apiClient.patch<IUser, UpdateUserBody>(`/api/v1/users/${id}`, body);
  },

  deleteUser(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/users/${id}`);
  },

  /**
   * Fire-and-forget: logs a client record access event so the backend can
   * notify the administrator (John Peter) that client data was viewed or edited.
   */
  logClientAccess(clientId: string): Promise<void> {
    return apiClient.post<void>(`/api/v1/clients/${clientId}/access-log`);
  },

  /** Send a 6-digit OTP to the current admin's email for client-section access. */
  requestAccessOtp(): Promise<{ email: string }> {
    return apiClient.post<{ email: string }>('/api/v1/clients/request-access-otp');
  },

  /** Verify the OTP the admin entered. Throws on wrong code, expiry, or lockout. */
  verifyAccessOtp(code: string): Promise<void> {
    return apiClient.post<void, { code: string }>('/api/v1/clients/verify-access-otp', { code });
  },

  // Soft delete — marks the user inactive and invalidates their sessions.
  deactivateUser(id: string): Promise<IUser> {
    return apiClient.patch<IUser>(`/api/v1/users/${id}/deactivate`);
  },

  listProfileChangeRequests(
    filters: ProfileChangeRequestFilters = {},
  ): Promise<PaginatedList<ProfileChangeRequest>> {
    return apiClient.getPaginated<ProfileChangeRequest>(
      '/api/v1/clients/profile-change-requests',
      { params: { per_page: 100, ...filters } as Record<string, unknown> },
    );
  },

  approveProfileChangeRequest(id: string, note?: string): Promise<ProfileChangeRequest> {
    return apiClient.post<ProfileChangeRequest, { note?: string }>(
      `/api/v1/clients/profile-change-requests/${id}/approve`,
      note ? { note } : {},
    );
  },

  rejectProfileChangeRequest(id: string, note?: string): Promise<ProfileChangeRequest> {
    return apiClient.post<ProfileChangeRequest, { note?: string }>(
      `/api/v1/clients/profile-change-requests/${id}/reject`,
      note ? { note } : {},
    );
  },

  /**
   * Admin/CS only: promote an email-created DRAFT job card to JOB_PLACED so
   * it enters the production pipeline and appears in the New Jobs view.
   */
  activateJobCard(id: string): Promise<IJobCard> {
    return apiClient.post<IJobCard>(`/api/v1/job-cards/${id}/activate`);
  },

  createJobCard(body: CreateJobCardBody): Promise<IJobCard> {
    return apiClient.post<IJobCard, CreateJobCardBody>('/api/v1/job-cards', body);
  },

  sendQuotePrice(jobId: string, body: SendQuotePriceBody): Promise<IJobCard> {
    return apiClient.post<IJobCard, SendQuotePriceBody>(
      `/api/v1/cs/jobs/${jobId}/quote/send-price`,
      body,
    );
  },

  listContactSubmissions(): Promise<IIngestedEmail[]> {
    return apiClient.get<IIngestedEmail[]>('/api/v1/contact-submissions');
  },

  getContactSubmission(id: string): Promise<IIngestedEmail> {
    return apiClient.get<IIngestedEmail>(`/api/v1/contact-submissions/${id}`);
  },
};
