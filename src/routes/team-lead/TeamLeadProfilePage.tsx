import { FileCheck, Inbox, LayoutDashboard, ScrollText, Users } from 'lucide-react';
import { RoleProfilePage, type ProfileAccessItem } from '@modules/shared-ui';

const ACCESS_ITEMS: ProfileAccessItem[] = [
  {
    icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    text: 'Dashboard — team load overview and at-risk job alerts',
    accent: 'crimson',
  },
  {
    icon: <Inbox className="w-3.5 h-3.5" />,
    text: 'Assignment Queue — assign approved jobs to designers and digitizors',
    accent: 'blue',
  },
  {
    icon: <FileCheck className="w-3.5 h-3.5" />,
    text: 'Junior Review — accept or reject work submitted by juniors',
    accent: 'teal',
  },
  {
    icon: <ScrollText className="w-3.5 h-3.5" />,
    text: 'Submitted Tasks — track jobs handed off downstream to QC/Sewout',
    accent: 'gold',
  },
  {
    icon: <Users className="w-3.5 h-3.5" />,
    text: 'Team Overview — staff capacity, workload, and performance reporting',
    accent: 'purple',
  },
];

const QUICK_LINKS = [
  { label: 'Dashboard', to: '/team-lead' },
  { label: 'Assignment Queue', to: '/team-lead/queue' },
  { label: 'Junior Review', to: '/team-lead/review' },
  { label: 'Submitted Tasks', to: '/team-lead/submitted' },
  { label: 'Team Overview', to: '/team-lead/team' },
];

export function TeamLeadProfilePage() {
  return (
    <RoleProfilePage
      accessItems={ACCESS_ITEMS}
      quickLinks={QUICK_LINKS}
      fallbackRoleLabel="Team Lead"
    />
  );
}
