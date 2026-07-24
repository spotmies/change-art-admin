import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Send, RotateCcw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { GreetingHero, Panel, ProducerSubmitModal, FilePreviewModal, type PreviewSource } from '@modules/shared-ui';
import { useAdminJobById, useAdminJobFiles, useAdminJobImageUrls, isAdminViewableImage } from '@modules/admin-panel/hooks/use-admin-jobs';
import { RejectionFeedback } from '@modules/admin-panel/components/RejectionFeedback';
import { adminService } from '@modules/admin-panel/services/admin.service';
import { toastApiError } from '@lib/toast-error';
import { getAllowedFormats } from '@lib/utils';
import { queryKeys } from '@lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { FileCategory } from '@contracts';
import { FileGrid } from './FileGrid';

const ACTIVE_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS']);
const REWORK_STATUSES = new Set(['TEAM_LEAD_REJECTED', 'SENIOR_REJECTED', 'QC_REJECTED']);

/**
 * Per-job producer workspace — Designer/Digitator/Sewout share this one page
 * (ChangeArt-New-PRD.md §5.4/§5.5/§5.6/§5.7): brief on the left, Original
 * Files vs Completed Files (with version history) side-by-side on the
 * right, feedback banner if rejected, and Accept/Submit/Rework actions.
 */
export function JobWorkspacePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSubmit, setShowSubmit] = useState(false);
  const [pending, setPending] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);

  const { data: job, isLoading } = useAdminJobById(jobId ?? '');
  const { data: files } = useAdminJobFiles(job?.uuid);

  const originalFiles = useMemo(() => (files ?? []).filter((f) => f.file_category === FileCategory.ORIGINAL), [files]);
  const originalImageFiles = useMemo(() => originalFiles.filter(isAdminViewableImage), [originalFiles]);

  const { data: originalUrls } = useAdminJobImageUrls(job?.uuid, originalImageFiles);

  // Team Lead's manual assignment IS the decision — a Designer/Digitator never
  // gets a choice to accept or decline. New assignments already land in
  // IN_PROGRESS (assignments.service.ts), but any job still sitting in ASSIGNED
  // (e.g. from before this change) is silently carried forward with no
  // button/toast. Sewout's separate 'sewout_accept' step is untouched.
  const autoAcceptedRef = useRef(false);
  useEffect(() => {
    if (job?.rawStatus === 'ASSIGNED' && job.uuid && job.version != null && !autoAcceptedRef.current) {
      autoAcceptedRef.current = true;
      adminService.transitionJob(job.uuid, 'accept', job.version)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
        })
        .catch(() => { autoAcceptedRef.current = false; });
    }
  }, [job?.rawStatus, job?.uuid, job?.version, queryClient]);

  if (isLoading || !job || !job.uuid) {
    return (
      <div className="page">
        <GreetingHero title="Job Workspace" subtitle="Loading…" />
      </div>
    );
  }

  const isSewoutOrder = job.order === 'Digitizing + Sewout';
  // Digitizing (with or without Sewout) routes Junior submissions to Senior
  // Digitator review; Artwork/Print/Other still goes to Team Lead review.
  const isDigitizingOrder = job.order === 'Digitizing' || job.order === 'Digitizing + Sewout';
  const isActive = !!job.rawStatus && ACTIVE_STATUSES.has(job.rawStatus);
  const isRework = !!job.rawStatus && REWORK_STATUSES.has(job.rawStatus);
  const isJuniorAssigned = job.subType === 'Junior';
  const isSewoutStage = job.rawStatus === 'SUBMITTED_TO_SEWOUT' || job.rawStatus === 'SEWOUT_IN_PROGRESS';

  const summaryText = job.summary || job.notes || '';
  const metadataRegex = /\[(.*?):\s*(.*?)\]/g;
  const summaryMetadata: { key: string; value: string }[] = [];
  let cleanedSummary = summaryText;
  let match;
  while ((match = metadataRegex.exec(summaryText)) !== null) {
    summaryMetadata.push({ key: match[1].trim(), value: match[2].trim() });
    cleanedSummary = cleanedSummary.replace(match[0], '');
  }
  cleanedSummary = cleanedSummary.trim();
  const allowedFormats = getAllowedFormats(job);

  const handleAccept = async () => {
    if (job.version == null) return;
    setPending(true);
    try {
      const action = isSewoutStage ? 'sewout_accept' : 'accept';
      await adminService.transitionJob(job.uuid!, action, job.version);
      toast.success('Accepted.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  const handleStartRework = async () => {
    if (job.version == null) return;
    setPending(true);
    try {
      const action = job.rawStatus === 'QC_REJECTED' ? 'rework_after_qc' : 'rework';
      await adminService.transitionJob(job.uuid!, action, job.version);
      toast.success('Moved back to In Progress — revise and resubmit.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
    } catch (err) {
      toastApiError(err);
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async (_uploadedFileIds: string[], stitchCount?: number) => {
    if (job.version == null) return;
    if (isSewoutStage) {
      await adminService.transitionJobWithStitchCount(job.uuid!, 'sewout_submit', job.version, stitchCount);
      toast.success('Submitted to QC.');
    } else {
      const isJunior = isJuniorAssigned;
      const action = isJunior
        ? (isDigitizingOrder ? 'submit_to_senior' : 'submit_to_team_lead')
        : isSewoutOrder ? 'senior_direct_to_sewout' : 'senior_direct_submit';
      await adminService.transitionJob(job.uuid!, action, job.version);
      toast.success(
        isJunior
          ? (isDigitizingOrder ? 'Submitted to Senior Digitator for review.' : 'Submitted to Team Lead.')
          : isSewoutOrder ? 'Routed to Sewout.' : 'Submitted to QC.',
      );
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.byId(job.uuid!) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });
  };

  const handleDownloadFile = async (id: string, name: string) => {
    const toastId = toast.loading(`Downloading ${name}…`);
    try {
      const res = await adminService.getDownloadUrl(id);
      const fileRes = await fetch(res.url);
      if (!fileRes.ok) throw new Error('Download failed');
      const blob = await fileRes.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('Downloaded.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download file.', { id: toastId });
    }
  };

  const handleDownloadAllOriginals = async () => {
    if (!originalFiles || originalFiles.length === 0) return;
    const toastId = toast.loading(`Preparing zip of ${originalFiles.length} file(s)…`);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      await Promise.all(
        originalFiles.map(async (f) => {
          const res = await adminService.getDownloadUrl(f.id);
          const fileRes = await fetch(res.url);
          if (!fileRes.ok) throw new Error(`Failed to fetch ${f.file_name}`);
          const blob = await fileRes.blob();
          zip.file(f.file_name, blob);
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${job?.ref || 'Job'}_Originals.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success('Zip file downloaded successfully.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to create zip file.', { id: toastId });
    }
  };

  return (
    <div className="page">
      <button type="button" className="btn btn-outline mb-3" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
        Back
      </button>

      <GreetingHero title={job.design} subtitle={`${job.ref} · ${job.order}`} />

      {isRework ? <RejectionFeedback jobId={job.uuid} /> : null}

      <div className="two-col">
        <div className="flex flex-col gap-3">
          <Panel title="Brief" className="panel-crimson shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Priority</div>
                <div className="text-[13px] font-semibold text-text-main truncate">{job.priority}</div>
              </div>
              {job.etaHours != null ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">ETA</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.etaHours}h</div>
                </div>
              ) : null}
              {job.placement ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Placement</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.placement}</div>
                </div>
              ) : null}
              {job.width != null && job.height != null ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Dimensions</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.width}&quot; × {job.height}&quot;</div>
                </div>
              ) : null}
              {job.fabric ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Fabric</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.fabric}</div>
                </div>
              ) : null}
              {job.colors != null ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Colors</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.colors}</div>
                </div>
              ) : null}
              {job.stitchCount != null ? (
                <div className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Stitches</div>
                  <div className="text-[13px] font-semibold text-text-main truncate">{job.stitchCount.toLocaleString()}</div>
                </div>
              ) : null}
            </div>
            {summaryText ? (
              <div className="mt-4 pt-4 border-t border-border/50 px-2 flex flex-col gap-3.5">
                {cleanedSummary ? (
                  <div>
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                      Description
                    </div>
                    <div className="text-[12.5px] leading-relaxed text-text-main whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-border/50">
                      {cleanedSummary}
                    </div>
                  </div>
                ) : null}
                {summaryMetadata.length > 0 ? (
                  <div>
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                      Specifications
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {summaryMetadata.map((m, i) => (
                        <div key={i} className="bg-black/5 dark:bg-white/5 p-2.5 rounded-lg border border-border/50 min-w-0">
                          <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5 truncate">
                            {m.key}
                          </div>
                          <div className="text-[13px] font-medium text-text-main break-words">
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <div className="job-actions flex-wrap">
            {isSewoutStage && job.rawStatus === 'SUBMITTED_TO_SEWOUT' ? (
              <button type="button" className="btn btn-crimson" disabled={pending} onClick={handleAccept}>
                <Play className="w-3.5 h-3.5" aria-hidden />
                Accept
              </button>
            ) : null}
            {isActive || job.rawStatus === 'SEWOUT_IN_PROGRESS' ? (
              <button type="button" className="btn btn-crimson" disabled={pending} onClick={() => setShowSubmit(true)}>
                <Send className="w-3.5 h-3.5" aria-hidden />
                Submit
              </button>
            ) : null}
            {isRework ? (
              <button type="button" className="btn btn-outline" disabled={pending} onClick={handleStartRework}>
                <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                Start Rework
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Panel 
            title="Original Files" 
            className="panel-amber shadow-sm"
            action={
              originalFiles.length > 0 ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-text-muted hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                  onClick={handleDownloadAllOriginals}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download All
                </button>
              ) : null
            }
          >
            <FileGrid
              imageFiles={originalImageFiles}
              imageUrls={originalUrls ?? []}
              otherFiles={originalFiles.filter((f) => !isAdminViewableImage(f))}
              onPreview={(url, name) => setPreviewSource({ kind: 'remote', url, name })}
              onDownload={handleDownloadFile}
            />
          </Panel>
        </div>
      </div>

      {previewSource && (
        <FilePreviewModal
          source={previewSource}
          onClose={() => setPreviewSource(null)}
        />
      )}

      {showSubmit ? (
        <ProducerSubmitModal
          jobUuid={job.uuid}
          jobLabel={job.id}
          title={isSewoutStage ? 'Submit Sewout to QC' : 'Submit Completed Work'}
          confirmLabel={isSewoutStage ? 'Submit to QC' : 'Submit'}
          requireStitchCount={isSewoutStage}
          allowedFormats={allowedFormats}
          onClose={() => setShowSubmit(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
