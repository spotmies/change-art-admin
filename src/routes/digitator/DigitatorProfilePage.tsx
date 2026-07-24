import { ClipboardList, Gauge, ScrollText } from 'lucide-react';
import { RoleProfilePage, type ProfileAccessItem } from '@modules/shared-ui';

const ACCESS_ITEMS: ProfileAccessItem[] = [
  {
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    text: 'My Tasks — accept assigned briefs and execute digitizing work',
    accent: 'crimson',
  },
  {
    icon: <ScrollText className="w-3.5 h-3.5" />,
    text: 'Submitted — track work handed off for review',
    accent: 'blue',
  },
  {
    icon: <Gauge className="w-3.5 h-3.5" />,
    text: 'My Analytics — personal throughput and turnaround stats',
    accent: 'teal',
  },
];

const QUICK_LINKS = [
  { label: 'My Tasks', to: '/digitator' },
  { label: 'Submitted', to: '/digitator/submitted' },
  { label: 'My Analytics', to: '/digitator/analytics' },
];

export function DigitatorProfilePage() {
  return (
    <RoleProfilePage
      accessItems={ACCESS_ITEMS}
      quickLinks={QUICK_LINKS}
      fallbackRoleLabel="Digitizor"
    />
  );
}
