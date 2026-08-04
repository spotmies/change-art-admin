import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useJobQueries, useRaiseQuery } from '@modules/admin-panel/hooks/use-job-queries';
import { useJobRoom } from '@lib/use-job-room';

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
  compact?: boolean;
}

export function JobQueriesSection({ jobId, compact = false }: JobQueriesSectionProps) {
  useJobRoom(jobId);
  const [text, setText] = useState('');
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
        setTimeout(() => {
          if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
          }
        }, 100);
      },
      onError: () => toast.error('Failed to send query. Please try again.'),
    });
  };

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [queries?.length]);

  const displayedQueries = queries ?? [];

  return (
    <div className={`flex flex-col ${compact ? 'flex-1 min-h-0' : 'h-[440px]'} bg-slate-50/50 rounded-lg border border-slate-200/80 overflow-hidden`}>
      {/* Header (shown when not compact) */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">
              Queries &amp; Messages
            </span>
          </div>
          {queries && queries.length > 0 && (
            <span className="text-[10.5px] font-bold bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5">
              {queries.length} {queries.length === 1 ? 'Message' : 'Messages'}
            </span>
          )}
        </div>
      )}

      {/* Chat Messages List */}
      <div
        ref={threadRef}
        className={`flex-1 overflow-y-auto bg-slate-50/40 ${compact ? 'p-1.5 space-y-1.5' : 'p-2.5 space-y-2'}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading messages…</span>
          </div>
        ) : queries && queries.length > 0 ? (
          <>
            {displayedQueries.map((q) => {
              const isAdmin = q.raised_by_role === 'ADMIN';
              return (
                <div
                  key={q.id}
                  className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-md shadow-xs ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11.5px]'} ${isAdmin
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-slate-800 border border-slate-200/80'
                      }`}
                  >
                    <div className="whitespace-pre-wrap leading-normal break-words">{q.message}</div>
                    <div className={`text-right mt-0.5 ${compact ? 'text-[7.5px]' : 'text-[9px]'} ${isAdmin ? 'text-purple-200/80' : 'text-slate-400'}`}>
                      {formatTime(q.created_at as unknown as string)}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-1 px-2">
            <div className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center mb-1">
              <MessageSquare className="w-3 h-3 text-purple-500" />
            </div>
            <p className={`font-semibold text-slate-700 ${compact ? 'text-[10px]' : 'text-[11.5px]'}`}>No messages yet</p>
            {!compact && <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-[200px]">Send a query directly to the client below.</p>}
          </div>
        )}
      </div>

      {/* WhatsApp-style Compose Input Bar */}
      <div className={`bg-white border-t border-slate-200/80 shrink-0 ${compact ? 'p-1.5' : 'p-2.5'}`}>
        <div className="flex items-center gap-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder="Enter query to client..."
            disabled={raiseQuery.isPending}
            className={`flex-1 rounded-xl border border-slate-200/90 text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 resize-none transition bg-slate-50/50 focus:bg-white ${compact ? 'px-2 py-1 text-[10.5px] max-h-12' : 'px-3 py-2 text-[12px] max-h-20'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || raiseQuery.isPending}
            className={`rounded-xl bg-purple-700 hover:bg-purple-800 disabled:bg-slate-200 text-white disabled:text-slate-400 transition shrink-0 shadow-xs flex items-center justify-center ${compact ? 'p-1.5' : 'p-2.5'}`}
            title="Send to Client"
          >
            {raiseQuery.isPending ? (
              <Loader2 className={compact ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} />
            ) : (
              <Send className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            )}
          </button>
        </div>
        {!compact && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
            <span>Press Enter to send, Shift+Enter for new line</span>
          </div>
        )}
      </div>
    </div>
  );
}
