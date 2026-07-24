import { Inbox, LayoutDashboard, ScrollText } from 'lucide-react';
import { RoleProfilePage, type ProfileAccessItem } from '@modules/shared-ui';

const ACCESS_ITEMS: ProfileAccessItem[] = [
  {
    icon: <Inbox className="w-3.5 h-3.5" />,
    text: 'Review Queue — approve or reject jobs submitted for quality check',
    accent: 'crimson',
  },
  {
    icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    text: 'QC Dashboard — throughput and rejection-rate stats',
    accent: 'blue',
  },
  {
    icon: <ScrollText className="w-3.5 h-3.5" />,
    text: 'History — past review decisions',
    accent: 'teal',
  },
];

const QUICK_LINKS = [
  { label: 'Review Queue', to: '/qc' },
  { label: 'QC Dashboard', to: '/qc/dashboard' },
  { label: 'History', to: '/qc/history' },
];

export function QCProfilePage() {
  return (
    <RoleProfilePage
      accessItems={ACCESS_ITEMS}
      quickLinks={QUICK_LINKS}
      fallbackRoleLabel="QC Reviewer"
    />
  );
}
