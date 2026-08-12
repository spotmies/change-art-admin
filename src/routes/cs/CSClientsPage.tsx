import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientRecordsView } from '../../modules/admin-panel/components/ClientRecordsView';
import { ClientSectionGateModal } from '../../modules/admin-panel/components/ClientSectionGateModal';

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
  const [isVerified, setIsVerified] = useState(() => isSessionVerified());

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
    <div className="w-full min-h-screen px-1 py-1">
      <ClientRecordsView isAdminView={false} />
    </div>
  );
}
