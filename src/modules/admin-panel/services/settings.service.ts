import type { ICcAuthorizationForm } from '@contracts';
import { apiClient } from '@lib/api-client';

interface PresignResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export const settingsService = {
  getCcForm(): Promise<ICcAuthorizationForm | null> {
    return apiClient.get<ICcAuthorizationForm | null>('/api/v1/settings/cc-form');
  },

  getCcFormDownloadUrl(): Promise<{ url: string; form: ICcAuthorizationForm }> {
    return apiClient.get<{ url: string; form: ICcAuthorizationForm }>(
      '/api/v1/settings/cc-form/download-url',
    );
  },

  deleteCcForm(): Promise<void> {
    return apiClient.delete<void>('/api/v1/settings/cc-form');
  },

  /** Presign → PUT to S3 → register. Mirrors cs-panel's uploadCompletedFile flow. */
  async uploadCcForm(file: File): Promise<ICcAuthorizationForm> {
    const presign = await apiClient.post<PresignResponse, object>('/api/v1/settings/cc-form/upload-url', {
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      file_size_bytes: file.size,
    });

    await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });

    return apiClient.post<ICcAuthorizationForm>('/api/v1/settings/cc-form/complete-upload', {
      storage_key: presign.storageKey,
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      file_size_bytes: file.size,
    });
  },
};
