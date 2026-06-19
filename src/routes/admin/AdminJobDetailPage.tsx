import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { JobDetailModal, EditJobModal, type Job } from '@modules/shared-ui';
import { useAdminJobById } from '../../modules/admin-panel/hooks/use-admin-jobs';

export function AdminJobDetailPage() {
  const { jobCardId } = useParams<{ jobCardId: string }>();
  const navigate = useNavigate();
  const [editJob, setEditJob] = useState<Job | null>(null);

  const { data: job, isLoading, isError } = useAdminJobById(jobCardId ?? '');

  function handleClose() {
    navigate('/admin/jobs');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-text-faint">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading job…</span>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-crimson" />
        <p className="text-sm font-semibold">Job not found</p>
        <p className="text-xs text-text-faint">
          This job may have been deleted or you don't have permission to view it.
        </p>
        <button type="button" className="btn btn-outline mt-2" onClick={handleClose}>
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <>
      <JobDetailModal job={job} onClose={handleClose} onEdit={(j) => setEditJob(j)} />
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
