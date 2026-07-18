import { useRef, useState } from 'react';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal, GreetingHero, Panel, StatGrid } from '@modules/shared-ui';
import { formatDateTime } from '@lib/utils';
import { toastApiError } from '@lib/toast-error';
import { useCcForm, useDeleteCcForm, useUploadCcForm } from '../../modules/admin-panel/hooks/use-cc-form';
import { settingsService } from '../../modules/admin-panel/services/settings.service';

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx'];

function isAcceptedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function CcAuthorizationFormPanel() {
  const { data: form, isLoading } = useCcForm();
  const uploadCcForm = useUploadCcForm();
  const deleteCcForm = useDeleteCcForm();
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error('Only PDF or Word (.doc/.docx) files are allowed.');
      return;
    }
    uploadCcForm.mutate(file);
  }

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const { url, form: current } = await settingsService.getCcFormDownloadUrl();
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = current.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toastApiError(err);
    } finally {
      setIsDownloading(false);
    }
  }

  const isBusy = uploadCcForm.isPending || deleteCcForm.isPending;

  return (
    <Panel title="Credit Card Authorization Form">
      <p className="text-[12.5px] text-text-muted mb-3">
        Uploaded here, this form is attached whenever an admin sends "Send CC Form" from a client's
        row action. Only one version is active at a time — uploading a new file replaces it.
      </p>

      {isLoading ? (
        <div className="text-[12.5px] text-text-muted">Loading…</div>
      ) : form ? (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-3" style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)' }}>
          <FileText aria-hidden className="w-4 h-4 shrink-0 text-text-muted" />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold truncate">{form.file_name}</div>
            <div className="text-[11px] text-text-muted">Uploaded {formatDateTime(form.uploaded_at)}</div>
          </div>
          <button
            type="button"
            className="btn btn-outline !p-1.5"
            onClick={handleDownload}
            disabled={isDownloading}
            aria-label="Download current form"
            title="Download current form"
          >
            {isDownloading ? (
              <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download aria-hidden className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            className="btn btn-outline !p-1.5"
            onClick={() => setDeleteOpen(true)}
            disabled={isBusy}
            aria-label="Delete current form"
            title="Delete current form"
          >
            <Trash2 aria-hidden className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-[12.5px] text-text-muted mb-3">No form uploaded yet.</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        className="qf-upload-zone cursor-pointer"
        role="button"
        tabIndex={0}
        aria-disabled={isBusy}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); if (!isBusy) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isBusy) handleFile(e.dataTransfer.files);
        }}
        style={isDragging ? { borderColor: 'var(--color-crimson)' } : undefined}
      >
        <div className="qf-upload-icon-wrap">
          {isBusy ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden style={{ color: 'var(--text-muted)' }} />
          ) : (
            <Upload className="w-5 h-5" aria-hidden style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <p className="qf-upload-label">
          {isBusy
            ? 'Uploading…'
            : (
              <>
                Drop {form ? 'a replacement' : 'a'} file here or <span className="qf-upload-browse">browse</span>
              </>
            )}
        </p>
        <p className="qf-upload-hint">PDF, DOC, or DOCX</p>
      </div>

      <ConfirmModal
        open={deleteOpen}
        tone="destructive"
        title="Delete the CC Authorization Form?"
        description="Admins won't be able to use Send CC Form until a new file is uploaded."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteCcForm.mutateAsync(undefined, { onSuccess: () => setDeleteOpen(false) });
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </Panel>
  );
}

export function AdminSettingsPage() {
  return (
    <div className="page">
      <GreetingHero
        title="Platform Settings"
        subtitle="Pricing catalogue, SLA tiers, role permissions, notification routing, and integrations."
      />

      <StatGrid
        stats={[
          { accent: 'blue', label: 'Pricing Version', value: 'v3.2' },
          { accent: 'teal', label: 'SLA Tiers', value: 4 },
          { accent: 'purple', label: 'Integrations', value: 6 },
          { accent: 'gold', label: 'Last Audit', value: '2 days ago' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Pricing Catalogue">
          <ul className="text-[12.5px] text-text-muted space-y-2">
            <li>• Base rates per order type</li>
            <li>• Complexity multipliers</li>
            <li>• Rush + Super Rush surcharges</li>
            <li>• Client-specific overrides</li>
          </ul>
        </Panel>

        <Panel title="SLA Tiers">
          <ul className="text-[12.5px] text-text-muted space-y-2">
            <li><span className="font-mono text-text">Normal</span> — 24h response</li>
            <li><span className="font-mono text-text">Rush</span> — 12h response</li>
            <li><span className="font-mono text-text">Super Rush</span> — 4h response</li>
            <li><span className="font-mono text-text">VIP Client</span> — 2h response</li>
          </ul>
        </Panel>

        <Panel title="Role Permissions">
          <ul className="text-[12.5px] text-text-muted space-y-2">
            <li>• 8 roles configured</li>
            <li>• Sub-types: Junior, Senior</li>
            <li>• Admin override scope</li>
            <li>• Audit log retention: 90 days</li>
          </ul>
        </Panel>

        <Panel title="Integrations">
          <ul className="text-[12.5px] text-text-muted space-y-2">
            <li>• Firebase Cloud Messaging — push</li>
            <li>• tus + S3 — file uploads</li>
            <li>• Email ingestion — quote requests</li>
            <li>• Better Auth — sessions</li>
          </ul>
        </Panel>

        <div className="lg:col-span-2">
          <CcAuthorizationFormPanel />
        </div>
      </div>
    </div>
  );
}
