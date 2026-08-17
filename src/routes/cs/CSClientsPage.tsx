import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClientRecordsView } from '../../modules/admin-panel/components/ClientRecordsView';
import { ClientSectionGateModal } from '../../modules/admin-panel/components/ClientSectionGateModal';
import { ProfileChangeRequestsTab } from '../../modules/admin-panel/components/ProfileChangeRequestsTab';
import { ClientApproveTab } from '../../modules/admin-panel/components/ClientApproveTab';

type Tab = 'clients' | 'approve' | 'requests';

const SESSION_FLAG = 'clients_otp_verified';

function isSessionVerified(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function markSessionVerified(): void {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    // ignore
  }
}

export function CSClientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerified, setIsVerified] = useState(() => isSessionVerified());

  const initialTab = (searchParams.get('tab') as Tab) || 'clients';
  const [tab, setTab] = useState<Tab>(['requests', 'approve'].includes(initialTab) ? initialTab : 'clients');

  useEffect(() => {
    const t = searchParams.get('tab') as Tab;
    if (['requests', 'clients', 'approve'].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  if (!isVerified) {
    return (
      <ClientSectionGateModal
        onVerified={() => {
          markSessionVerified();
          setIsVerified(true);
        }}
        onDismiss={() => {
          navigate('/cs', { replace: true });
        }}
      />
    );
  }

  return (
    <div className="w-full px-0.5 py-0">
      {/* Main Tab Content */}
      {tab === 'clients' && (
        <ClientRecordsView
          isAdminView={true}
          onNavigateToApprove={() => setTab('approve')}
          onNavigateToProfileRequests={() => setTab('requests')}
        />
      )}

      {tab === 'approve' && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Client Signup Requests</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Review, approve, or reject new self-registered client account applications.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0"
              onClick={() => setTab('clients')}
            >
              ← Back to Clients Directory
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm">
            <ClientApproveTab />
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Profile Change Requests</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Review and approve profile information update requests submitted by clients.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0"
              onClick={() => setTab('clients')}
            >
              ← Back to Clients Directory
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm">
            <ProfileChangeRequestsTab search="" />
          </div>
        </div>
      )}
    </div>
  );
}
