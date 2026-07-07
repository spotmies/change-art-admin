import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, CheckCircle2 } from 'lucide-react';
import { cn } from '@lib/utils';
import { type Job, jobImages } from '../mocks/jobs';

// ─── Badge helpers (duplicated from JobTable to avoid coupling) ───────────────

function statusBadgeAccent(status: string): string {
  const map: Record<string, string> = {
    'In QC': 'teal', 'In Production': 'amber', 'Senior Review': 'purple',
    Sewout: 'purple', Dispatched: 'green', 'Quote Submitted': 'blue',
    'Quote Approved': 'amber', 'Pending Client Confirm': 'amber',
    Cancelled: 'gray', Amend: 'amber', 'In Review': 'purple',
  };
  return map[status] ?? 'gray';
}

function orderBadgeAccent(order: string): string {
  const map: Record<string, string> = {
    Artwork: 'navy', Digitizing: 'teal',
    'Digitizing + Sewout': 'purple', Sewout: 'purple',
  };
  return map[order] ?? 'gray';
}

function priorityClass(p: string) {
  const map: Record<string, string> = {
    Normal: 'normal', Rush: 'rush', 'Super Rush': 'super-rush',
  };
  return map[p] ?? 'normal';
}

function Badge({ children, accent }: { children: ReactNode; accent: string }) {
  return <span className={cn('badge', accent)}>{children}</span>;
}

function PriorityChip({ priority }: { priority: string }) {
  return <span className={cn('priority-badge', priorityClass(priority))}>{priority}</span>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

// ─── Workflow steps ───────────────────────────────────────────────────────────

type StepState = 'done' | 'cur' | 'pending';

function buildSteps(job: Job): { role: string; note: string; state: StepState }[] {
  const raw = (job.rawStatus ?? '').toUpperCase();
  let productionNote = 'In Progress';
  if (raw === 'JOB_PLACED' || raw === 'CS_APPROVED') {
    productionNote = 'Pending';
  } else if (job.etaHours) {
    productionNote = `ETA: ${job.etaHours}h`;
  }

  const base: [string, string][] = [
    ['Client Servicing', 'Created'],
    ['In Production', productionNote],
    ['Client Servicing', 'Dispatch']
  ];

  const stageIdx: Record<string, number> = {
    quote: 0,
    delivered: 2,
  };
  const cur = stageIdx[job.stage] ?? 1;

  return base.map(([role, note], i) => ({
    role,
    note,
    state: i < cur ? 'done' : i === cur ? 'cur' : 'pending',
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JobModalProps {
  job: Job | null;
  onClose: () => void;
}

export function JobModal({ job, onClose }: JobModalProps) {
  useEffect(() => {
    if (!job) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [job, onClose]);

  if (!job) return null;

  const images = jobImages(job, 3);
  const steps = buildSteps(job);

  const details: [string, string][] = [
    ['Client ID', job.clientId],
    ['Order Type', job.order],
    ...(job.specificType ? [['Specific Service', job.specificType] as [string, string]] : []),
    ['Complexity', job.complexity],
    ['Assigned To', job.assignedTo ?? 'Pending'],
    ['Sub-Type', job.subType ?? '—'],
  ];

  const specs: [string, string, boolean?][] = [
    ['ETA', job.etaHours ? `${job.etaHours}h` : '—'],
    ['Created', formatDate(job.created)],
    ['Reference', job.ref, true],
    ['Colors', String(job.colors)],
    ...(job.finalFiles?.length
      ? [[
          'Output Formats',
          (() => {
            const text = job.notes || job.summary;
            const match = text?.match(/\[\s*Expected Output Format\s*:\s*([^\]]*?)\s*\]/i);
            const customFormat = match && match[1] ? match[1].trim() : null;
            return job.finalFiles.map(f => {
              if (f.toUpperCase() === 'OTHERS' || f.toUpperCase() === 'OTHER') {
                if (customFormat) {
                  if (/^others:\s*/i.test(customFormat)) {
                    return customFormat.replace(/^others:\s*/i, 'Others: ');
                  }
                  return `Others: ${customFormat}`;
                }
                return f;
              }
              return f;
            }).join(', ');
          })()
        ] as [string, string]]
      : []),
    ...(job.placement ? [['Placement', job.placement] as [string, string]] : []),
    ...(job.width    ? [['Width',     `${job.width}"`] as [string, string]] : []),
    ...(job.height   ? [['Height',    `${job.height}"`] as [string, string]] : []),
    ...(job.fabric   ? [['Fabric',    job.fabric] as [string, string]] : []),
    ...(job.stitchCount  ? [['Stitch Count', job.stitchCount.toLocaleString()] as [string, string]] : []),
    ...(job.clientPrice  ? [['Client Budget', `$${job.clientPrice}`] as [string, string]] : []),
    ...(job.adminPrice   ? [['Admin Price',   `$${job.adminPrice}`] as [string, string]] : []),
    ...(job.agreedPrice  ? [['Agreed Price',  `$${job.agreedPrice}`] as [string, string]] : []),
  ];

  const modal = (
    <div
      className="modal-overlay open"
      onClick={undefined}
      role="dialog"
      aria-modal
      aria-label={`Job details: ${job.design}`}
    >
      <div className="modal">

        {/* ── Header ── */}
        <div className="modal-top">
          <div style={{ flex: 1 }}>
            <div className="modal-job-id">{job.id}&nbsp;·&nbsp;{job.ref}</div>
            <div className="modal-title line-clamp-2 break-words">{job.design}</div>
            <div className="modal-tags">
              <Badge accent={orderBadgeAccent(job.order)}>{job.order}</Badge>
              <Badge accent={statusBadgeAccent(job.status)}>{job.status}</Badge>
              <Badge accent={job.project === 'Amend' ? 'amber' : 'gray'}>{job.project}</Badge>
              <PriorityChip priority={job.priority} />
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body">

          {/* Image gallery */}
          <div className="m-sec-title">Job Images</div>
          <div className="modal-gallery">
            {images.map((src, i) => (
              <img
                key={`${job.id}-${src}-${i}`}
                src={src}
                alt={`${job.design} ${i + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
          </div>

          {/* Workflow stepper */}
          <div className="wf-steps">
            {steps.map((s, i) => (
              <div key={i} className={cn('wf-step', s.state === 'done' && 'done', s.state === 'cur' && 'cur')}>
                <div className="wf-dot">
                  {s.state === 'done' && <CheckCircle2 className="w-3 h-3" aria-hidden />}
                </div>
                <div className="wf-lbl">
                  {s.role}
                  <br />
                  <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>{s.note}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Details + Specs */}
          <div className="modal-grid">
            <div>
              <div className="m-sec-title">Job Details</div>
              {details.map(([k, v]) => (
                <div key={k} className="f-row">
                  <div className="f-key">{k}</div>
                  <div className="f-val">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="m-sec-title">Specifications</div>
              {specs.map(([k, v, mono]) => (
                <div key={k} className="f-row">
                  <div className="f-key">{k}</div>
                  <div className={cn('f-val', mono && 'mono')}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="m-sec-title">Notes / Brief</div>
          <div className="modal-notes">{job.notes}</div>
        </div>

        {/* ── Footer ── */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginRight: 'auto' }}
            onClick={() => {}}
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            <span>Download Files</span>
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
