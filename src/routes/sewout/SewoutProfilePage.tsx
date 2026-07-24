import { ClipboardList, ScrollText } from 'lucide-react';
import { RoleProfilePage, type ProfileAccessItem } from '@modules/shared-ui';

const ACCESS_ITEMS: ProfileAccessItem[] = [
  {
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    text: 'My Tasks — accept assigned jobs and complete sewout work',
    accent: 'crimson',
  },
  {
    icon: <ScrollText className="w-3.5 h-3.5" />,
    text: 'Sewout History — track completed and submitted work',
    accent: 'blue',
  },
];

const QUICK_LINKS = [
  { label: 'My Tasks', to: '/sewout' },
  { label: 'Sewout History', to: '/sewout/history' },
];

export function SewoutProfilePage() {
  return (
    <RoleProfilePage
      accessItems={ACCESS_ITEMS}
      quickLinks={QUICK_LINKS}
      fallbackRoleLabel="Sewout"
    />
  );
}
