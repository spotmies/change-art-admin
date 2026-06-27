import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, AlertCircle, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useJobQueries, useRaiseQuery } from '@modules/admin-panel/hooks/use-job-queries';
import { useJobRoom } from '@lib/use-job-room';

const CRIMSON = '#B22234';
const BORDER = '#E2E8F0';
const MUTED = '#64748B';
const INK = '#0D1B2A';
const BLUE = '#1D4ED8';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface JobQueriesSectionProps {
  jobId: string | null | undefined;
}

export function JobQueriesSection({ jobId }: JobQueriesSectionProps) {
  useJobRoom(jobId);
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const { data: queries, isLoading } = useJobQueries(jobId);
  const raiseQuery = useRaiseQuery(jobId);
  const threadRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    const msg = text.trim();
    if (!msg || !jobId || raiseQuery.isPending) return;
    raiseQuery.mutate(msg, {
      onSuccess: () => {
        setText('');
        toast.success('Query sent to client.');
        setShowAll(true);
        setTimeout(() => {
          if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
          }
        }, 100);
      },
      onError: () => toast.error('Failed to send query. Please try again.'),
    });
  };

  const prevLengthRef = useRef(queries?.length);

  useEffect(() => {
    if (threadRef.current) {
      const lengthChanged = queries?.length !== prevLengthRef.current;
      prevLengthRef.current = queries?.length;

      if (showAll || lengthChanged) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight;
      } else {
        threadRef.current.scrollTop = 0;
      }
    }
  }, [queries?.length, showAll]);

  const displayedQueries = queries
    ? (showAll ? queries : queries.slice(-3))
    : [];

  return (
    <div style={{ marginTop: 24, borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <MessageSquare style={{ width: 15, height: 15, color: CRIMSON }} aria-hidden />
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Queries &amp; Questions
        </span>
        {queries && queries.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, background: CRIMSON, color: '#fff', borderRadius: 99, padding: '1px 7px' }}>
            {queries.length}
          </span>
        )}
      </div>

      {/* Thread */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 12, marginBottom: 16 }}>
          <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          Loading…
        </div>
      ) : queries && queries.length > 0 ? (
        <div
          ref={threadRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            marginBottom: 20,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            overflowY: 'auto',
            maxHeight: '280px',
          }}
        >
          {queries && queries.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                width: '100%',
                padding: '10px 16px',
                background: '#ffffff',
                border: 'none',
                borderBottom: `1px solid ${BORDER}`,
                color: CRIMSON,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              <MessageSquare style={{ width: 12, height: 12 }} />
              {showAll ? 'Hide past queries' : `View past queries (${queries.length - 3} hidden)`}
            </button>
          )}
          {displayedQueries.map((q, idx) => {
            const isAdmin = q.raised_by_role === 'ADMIN';
            const isLast = idx === displayedQueries.length - 1;
            return (
              <div
                key={q.id}
                style={{
                  padding: '12px 16px',
                  background: isAdmin ? '#F0F4FF' : '#FFF9F9',
                  borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${isAdmin ? BLUE : CRIMSON}`,
                }}
              >
                {/* Row 1: avatar + sender + role badge + time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isAdmin ? 'rgba(29,78,216,0.12)' : 'rgba(178,34,52,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isAdmin
                      ? <Users style={{ width: 13, height: 13, color: BLUE }} aria-hidden />
                      : <User style={{ width: 13, height: 13, color: CRIMSON }} aria-hidden />}
                  </div>

                  {/* Name */}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>
                    {q.raised_by_name ?? (isAdmin ? 'Admin' : 'Client')}
                  </span>

                  {/* Role badge */}
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: isAdmin ? BLUE : CRIMSON,
                    background: isAdmin ? 'rgba(29,78,216,0.1)' : 'rgba(178,34,52,0.1)',
                    borderRadius: 4, padding: '2px 7px',
                  }}>
                    {isAdmin ? 'Admin' : 'Client'}
                  </span>

                  {/* Spacer + time */}
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: MUTED }}>
                    {formatTime(q.created_at as unknown as string)}
                  </span>
                </div>

                {/* Message */}
                <div style={{ paddingLeft: 36, fontSize: 13, color: INK, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {q.message}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: MUTED, fontSize: 12, marginBottom: 16, padding: '10px 0' }}>
          <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden />
          No queries yet. Use the form below to send a question to the client.
        </div>
      )}

      {/* Compose */}
      <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Send a question to the client
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Describe your question clearly so the client can respond…"
          disabled={raiseQuery.isPending}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px',
            fontSize: 13,
            color: INK,
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = BLUE; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = BORDER; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: MUTED }}>Ctrl+Enter to send</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || raiseQuery.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', fontSize: 12.5, fontWeight: 700, color: '#fff',
              background: text.trim() && !raiseQuery.isPending
                ? `linear-gradient(135deg,${CRIMSON},#8B1A28)` : '#CBD5E1',
              border: 'none', borderRadius: 8,
              cursor: text.trim() && !raiseQuery.isPending ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s', letterSpacing: '0.02em',
            }}
          >
            {raiseQuery.isPending
              ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
              : <Send style={{ width: 13, height: 13 }} />}
            {raiseQuery.isPending ? 'Sending…' : 'Send to Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
