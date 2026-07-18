import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Search, ExternalLink, Mail, Paperclip, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { GreetingHero, Pagination, Panel, StatGrid } from '@modules/shared-ui';
import { EmailIngestionStatus, JobStatus, type IIngestedEmail, type IContactSubmissionAiData } from '@contracts';
import { queryKeys } from '@lib/query-keys';
import {
  useContactSubmissions,
  useContactSubmission,
} from '../../modules/admin-panel/hooks/use-contact-submissions';
import { useActivateJobCard } from '../../modules/admin-panel/hooks/use-admin-jobs';
import { adminService } from '../../modules/admin-panel/services/admin.service';

const PER_PAGE = 20;

type StatusFilter = 'ALL' | EmailIngestionStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: EmailIngestionStatus.PROCESSED, label: 'Processed' },
  { id: EmailIngestionStatus.IGNORED, label: 'Ignored' },
  { id: EmailIngestionStatus.FAILED, label: 'Failed' },
  { id: EmailIngestionStatus.PENDING, label: 'Pending' },
];

const STATUS_BADGE: Record<EmailIngestionStatus, string> = {
  [EmailIngestionStatus.PROCESSED]: 'green',
  [EmailIngestionStatus.IGNORED]: 'gold',
  [EmailIngestionStatus.FAILED]: 'crimson',
  [EmailIngestionStatus.PENDING]: 'blue',
};

const STATUS_LABEL: Record<EmailIngestionStatus, string> = {
  [EmailIngestionStatus.PROCESSED]: 'Processed',
  [EmailIngestionStatus.IGNORED]: 'Ignored',
  [EmailIngestionStatus.FAILED]: 'Failed',
  [EmailIngestionStatus.PENDING]: 'Pending',
};

const INTENT_BADGE: Record<string, string> = {
  ORDER: 'blue',
  QUOTE_REQUEST: 'navy',
  REJECTED: 'gray',
};

const INTENT_LABEL: Record<string, string> = {
  ORDER: 'Order',
  QUOTE_REQUEST: 'Quote Request',
  REJECTED: 'Rejected',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function confidencePct(raw: string | null): number | null {
  if (!raw) return null;
  return Math.round(parseFloat(raw) * 100);
}

export function AdminEmailInboxPage({ jobsPath = '/admin/jobs' }: { jobsPath?: string }) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Track job card IDs that have been activated this session so the button
  // stays removed even when the user switches between emails in the list.
  const [activatedJobIds, setActivatedJobIds] = useState<Set<string>>(new Set());
  function markActivated(jobCardId: string) {
    setActivatedJobIds((prev) => new Set(prev).add(jobCardId));
  }

  const { data: items = [], isLoading, isError } = useContactSubmissions();

  const stats = useMemo(() => {
    const processed = items.filter((e) => e.ai_status === EmailIngestionStatus.PROCESSED).length;
    const ignored = items.filter((e) => e.ai_status === EmailIngestionStatus.IGNORED).length;
    const failed = items.filter((e) => e.ai_status === EmailIngestionStatus.FAILED).length;
    return { total: items.length, processed, ignored, failed };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      if (statusFilter !== 'ALL' && e.ai_status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.from_email.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleRowClick(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="page" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* ── Main column ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <GreetingHero
          title="Email Inbox"
          subtitle="Inbound emails processed by AI — orders and quote requests are auto-converted to draft job cards."
        />

        <StatGrid
          stats={[
            { accent: 'blue', label: 'Total Received', value: isLoading ? '…' : stats.total },
            { accent: 'green', label: 'Processed', value: isLoading ? '…' : stats.processed },
            { accent: 'gold', label: 'Ignored', value: isLoading ? '…' : stats.ignored },
            { accent: 'crimson', label: 'Failed', value: isLoading ? '…' : stats.failed },
          ]}
        />

        <Panel title={`Email Submissions${filtered.length ? ` (${filtered.length})` : ''}`}>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-glass-border">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn ${statusFilter === f.id ? 'btn-crimson' : 'btn-outline'}`}
                  onClick={() => { setStatusFilter(f.id); setPage(1); }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-md ml-auto">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint"
                aria-hidden
              />
              <input
                type="text"
                className="fi"
                style={{ paddingLeft: 28, paddingRight: search ? 32 : undefined }}
                placeholder="Search sender or subject…"
                value={search}
                maxLength={500}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                aria-label="Search emails"
              />
              {search && (
                <button
                  type="button"
                  className="fjb-search-x"
                  onClick={() => { setSearch(''); setPage(1); }}
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-text-faint text-sm">
              Loading emails…
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-[var(--color-crimson)] text-sm">
              Failed to load emails. Please refresh and try again.
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-text-faint text-sm">
              {search.trim() || statusFilter !== 'ALL'
                ? 'No emails match your filters.'
                : 'No emails received yet.'}
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {pageRows.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    selected={selectedId === email.id}
                    onClick={() => handleRowClick(email.id)}
                    onViewJob={(jobId) => navigate(`${jobsPath}?open=${jobId}`)}
                  />
                ))}
              </ul>

              <Pagination
                page={page}
                totalPages={totalPages}
                total={filtered.length}
                perPage={PER_PAGE}
                onPageChange={setPage}
              />
            </>
          )}
        </Panel>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {selectedId && (
        <DetailPanel
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onViewJob={(jobId) => navigate(`${jobsPath}?open=${jobId}`)}
          activatedJobIds={activatedJobIds}
          onActivated={markActivated}
        />
      )}
    </div>
  );
}

// ─── Email row ───────────────────────────────────────────────────────────────

interface EmailRowProps {
  email: IIngestedEmail;
  selected: boolean;
  onClick: () => void;
  onViewJob: (jobId: string) => void;
}

function EmailRow({ email, selected, onClick, onViewJob }: EmailRowProps) {
  const pct = confidencePct(email.ai_confidence);

  return (
    <li
      className="flex items-start gap-3 px-3 py-2.5 rounded-md border transition-colors cursor-pointer"
      style={{
        borderColor: selected ? 'var(--color-crimson)' : 'var(--glass-border)',
        background: selected ? 'rgba(220,38,38,0.04)' : 'transparent',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <Mail className="w-4 h-4 mt-0.5 shrink-0 text-text-faint" aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${STATUS_BADGE[email.ai_status]}`}>
            {STATUS_LABEL[email.ai_status]}
          </span>
          {email.ai_intent && email.ai_intent !== 'REJECTED' && (
            <span className={`badge ${INTENT_BADGE[email.ai_intent] ?? 'gray'}`}>
              {INTENT_LABEL[email.ai_intent] ?? email.ai_intent}
            </span>
          )}
          <span className="font-semibold text-[13px] truncate">{email.subject}</span>
          <span className="text-[11px] text-text-faint ml-auto shrink-0">
            {formatDateTime(email.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-[12px] text-text-muted">{email.from_email}</span>
          {pct !== null && (
            <span className="text-[11px] text-text-faint">Confidence: {pct}%</span>
          )}
          {email.attachments.length > 0 && (
            <span className="text-[11px] text-text-faint flex items-center gap-1">
              <Paperclip className="w-3 h-3" aria-hidden />
              {email.attachments.length}
            </span>
          )}
          {email.linked_job_card_id && (
            <button
              type="button"
              className="btn btn-outline ml-auto"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={(e) => { e.stopPropagation(); onViewJob(email.linked_job_card_id!); }}
            >
              <ExternalLink className="w-3 h-3" aria-hidden />
              View Job Card
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

interface DetailPanelProps {
  id: string;
  onClose: () => void;
  onViewJob: (jobId: string) => void;
  activatedJobIds: Set<string>;
  onActivated: (jobCardId: string) => void;
}

function DetailPanel({ id, onClose, onViewJob, activatedJobIds, onActivated }: DetailPanelProps) {
  const { data: email, isLoading } = useContactSubmission(id);

  return (
    <div
      style={{
        width: 400,
        flexShrink: 0,
        position: 'sticky',
        top: 80,
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-[14px]">Email Detail</span>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '2px 6px' }}
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      {isLoading ? (
        <div className="text-text-faint text-sm py-8 text-center">Loading…</div>
      ) : !email ? (
        <div className="text-[var(--color-crimson)] text-sm py-8 text-center">Failed to load.</div>
      ) : (
        <EmailDetail
          email={email}
          onViewJob={onViewJob}
          activatedJobIds={activatedJobIds}
          onActivated={onActivated}
        />
      )}
    </div>
  );
}

// ─── Email detail content ─────────────────────────────────────────────────────

function EmailDetail({
  email,
  onViewJob,
  activatedJobIds,
  onActivated,
}: {
  email: IIngestedEmail;
  onViewJob: (id: string) => void;
  activatedJobIds: Set<string>;
  onActivated: (jobCardId: string) => void;
}) {
  const pct = confidencePct(email.ai_confidence);
  const ai = email.ai_extracted_data;
  const activateMutation = useActivateJobCard();

  // Fetch the linked job card's live status so the button stays hidden across
  // page refreshes — session state alone resets on reload.
  const { data: linkedJobCard } = useQuery({
    queryKey: queryKeys.jobs.byId(email.linked_job_card_id ?? ''),
    queryFn: () => adminService.getJobCard(email.linked_job_card_id!),
    enabled: !!email.linked_job_card_id,
    staleTime: 0,
  });

  const jobAlreadyActivated =
    !!email.linked_job_card_id && (
      activatedJobIds.has(email.linked_job_card_id) ||
      (linkedJobCard !== undefined && linkedJobCard?.status !== JobStatus.DRAFT)
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5 pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <MetaRow label="From" value={email.from_email} />
        <MetaRow label="To" value={email.to_email} />
        <MetaRow label="Received" value={formatDateTime(email.created_at)} />
      </div>

      {/* AI analysis */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          AI Analysis
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${STATUS_BADGE[email.ai_status]}`}>
            {STATUS_LABEL[email.ai_status]}
          </span>
          {email.ai_intent && (
            <span className={`badge ${INTENT_BADGE[email.ai_intent] ?? 'gray'}`}>
              {INTENT_LABEL[email.ai_intent] ?? email.ai_intent}
            </span>
          )}
        </div>

        {pct !== null && (
          <div>
            <div className="flex justify-between text-[11px] text-text-faint mb-1">
              <span>Confidence</span>
              <span>{pct}%</span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: 'var(--glass-border-bright)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: pct >= 70 ? 'var(--color-green)' : 'var(--color-gold)',
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}

        {ai && <AiFields data={ai} />}

        {email.linked_job_card_id && (
          <div className="flex flex-col gap-2 mt-1">
            {/* Hidden once the job is in the pipeline (this session or previous) */}
            {!jobAlreadyActivated && (
              <button
                type="button"
                disabled={activateMutation.isPending}
                onClick={() => {
                  activateMutation.mutate(email.linked_job_card_id!, {
                    onSuccess: () => {
                      onActivated(email.linked_job_card_id!);
                      toast.success('Job added to production pipeline!');
                    },
                    onError: (err: unknown) => {
                      // If the job was already placed (e.g. from a previous
                      // session), treat it the same as success so the button
                      // disappears — no need to show an error.
                      if (err instanceof Error && err.message.includes('production pipeline')) {
                        onActivated(email.linked_job_card_id!);
                        toast.success('Job is already in the production pipeline.');
                      } else {
                        const msg = err instanceof Error ? err.message : 'Failed to add job.';
                        toast.error(msg);
                      }
                    },
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  width: '100%',
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: activateMutation.isPending
                    ? 'rgba(5,150,105,0.45)'
                    : 'linear-gradient(135deg,#059669,#047857)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: activateMutation.isPending ? 'not-allowed' : 'pointer',
                  boxShadow: activateMutation.isPending ? 'none' : '0 3px 10px rgba(5,150,105,0.35)',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.01em',
                }}
              >
                {activateMutation.isPending ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <PlusCircle className="w-3.5 h-3.5" aria-hidden />
                )}
                {activateMutation.isPending ? 'Adding…' : 'Add to Jobs'}
              </button>
            )}

            <button
              type="button"
              className="btn btn-crimson w-full"
              onClick={() => onViewJob(email.linked_job_card_id!)}
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              View Job Card
            </button>
          </div>
        )}
      </div>

      {/* Email body */}
      <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          Email Body
        </p>
        {email.subject && (
          <p className="text-[13px] font-semibold leading-snug">{email.subject}</p>
        )}
        <div
          className="text-[12px] text-text-muted whitespace-pre-wrap leading-relaxed"
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 6,
            padding: '8px 10px',
          }}
        >
          {email.body || <span className="text-text-faint italic">No body content.</span>}
        </div>
      </div>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Attachments ({email.attachments.length})
          </p>
          <ul className="flex flex-col gap-3">
            {email.attachments.map((att, i) => (
              <li key={i} className="flex flex-col gap-1.5 text-[12px]">
                {/* Image preview */}
                {att.type === 'image' && att.url && (
                  <img
                    src={att.url}
                    alt={att.filename}
                    style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid var(--glass-border)' }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <Paperclip className="w-3 h-3 text-text-faint shrink-0" aria-hidden />
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...(att.type === 'other' ? { download: att.filename } : {})}
                      className="truncate hover:underline"
                      style={{ color: 'var(--color-crimson)' }}
                    >
                      {att.type === 'pdf' ? 'Open PDF — ' : att.type === 'image' ? 'View — ' : 'Download — '}
                      {att.filename}
                    </a>
                  ) : (
                    <span className="text-text-muted truncate">{att.filename}</span>
                  )}
                  <span className="text-text-faint ml-auto shrink-0">{att.size}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── AI extracted fields grid ─────────────────────────────────────────────────

function AiFields({ data }: { data: IContactSubmissionAiData }) {
  const fields: { label: string; value: string | number | undefined }[] = [
    { label: 'Design Name', value: data.design_name },
    { label: 'Order Type', value: data.order_type },
    { label: 'Priority', value: data.priority },
    { label: 'Colors', value: data.num_colors },
    { label: 'Width (in)', value: data.width_inches },
    { label: 'Height (in)', value: data.height_inches },
    { label: 'Contact', value: data.contact_name },
    { label: 'Phone', value: data.contact_number },
    { label: 'Notes', value: data.notes },
    { label: 'Rejection Reason', value: data.rejection_reason },
  ].filter((f) => f.value !== undefined && f.value !== null && f.value !== '');

  if (fields.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.1)',
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <dl className="flex flex-col gap-1">
        {fields.map((f) => (
          <div key={f.label} className="flex gap-2 text-[12px]">
            <dt className="text-text-faint shrink-0" style={{ minWidth: 90 }}>{f.label}</dt>
            <dd className="text-text-main font-medium truncate">{String(f.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-text-faint shrink-0" style={{ minWidth: 50 }}>{label}</span>
      <span className="text-text-muted truncate">{value}</span>
    </div>
  );
}
