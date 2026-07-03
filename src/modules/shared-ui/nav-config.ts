import {
  Bell,
  ClipboardList,
  FileCheck,
  Gauge,
  Inbox,
  LayoutDashboard,
  Mail,
  PencilRuler,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '@contracts';

/**
 * Per-role navigation manifest. Mirrors the `ROLE_CFG` table embedded in
 * change_artwork_demo_v2.html — every role has a curated list of nav
 * groups + items. Items resolve to React Router paths under each role's
 * namespace.
 *
 * `badge` is a getter rather than a literal so unread counts can be wired
 * to TanStack Query selectors at the Sidebar render layer.
 */

export type NavBadgeAccent = 'crimson' | 'amber' | 'green' | 'navy';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  badgeAccent?: NavBadgeAccent;
  subtitle?: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface RoleNavConfig {
  label: string;
  sections: NavSection[];
  mobile: NavItem[]; // 5 bottom-nav items max
}

// CLIENT is intentionally absent — this app is admin/internal only.
export const NAV_CONFIG = {
  [UserRole.CS]: {
    label: 'Client Servicing',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'dashboard', label: 'Dashboard', to: '/cs', icon: LayoutDashboard },
          { id: 'new-quotes', label: 'New Quotes', to: '/cs/new-quotes', icon: Inbox },
          { id: 'new-jobs', label: 'New Jobs', to: '/cs/new-jobs', icon: ScrollText },
          { id: 'projects', label: 'All Projects', to: '/cs/projects', icon: ClipboardList },
          { id: 'email-inbox', label: 'Email Inbox', to: '/cs/email-inbox', icon: Mail },
          { id: 'queue', label: 'Job Queue', to: '/cs/queue', icon: Gauge },
          { id: 'deliver', label: 'Ready to Deliver', to: '/cs/deliver', icon: Truck },
          { id: 'amend', label: 'Amendments', to: '/cs/amendments', icon: PencilRuler },
        ],
      },
      {
        id: 'create',
        label: 'Create',
        items: [
          { id: 'create-quote', label: 'Create Quote', to: '/cs/create-quote', icon: Sparkles },
          { id: 'place-order', label: 'Place Order', to: '/cs/place-order', icon: Send },
        ],
      },
      {
        id: 'records',
        label: 'Records',
        items: [{ id: 'clients', label: 'Client Records', to: '/cs/clients', icon: Users }],
      },
    ],
    mobile: [
      { id: 'dashboard', label: 'Home', to: '/cs', icon: LayoutDashboard },
      { id: 'queue', label: 'Queue', to: '/cs/queue', icon: Gauge },
      { id: 'deliver', label: 'Deliver', to: '/cs/deliver', icon: Truck },
      { id: 'create-quote', label: 'Quote', to: '/cs/create-quote', icon: Sparkles },
      { id: 'clients', label: 'Clients', to: '/cs/clients', icon: Users },
    ],
  },

  [UserRole.TEAM_LEAD]: {
    label: 'Operations',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'dashboard', label: 'Dashboard', to: '/team-lead', icon: LayoutDashboard },
          { id: 'queue', label: 'Assignment Queue', to: '/team-lead/queue', icon: Inbox },
          { id: 'review', label: 'Junior Review', to: '/team-lead/review', icon: FileCheck },
          { id: 'submitted', label: 'Submitted Tasks', to: '/team-lead/submitted', icon: ScrollText },
          { id: 'team', label: 'Team Overview', to: '/team-lead/team', icon: Users },
        ],
      },
    ],
    mobile: [
      { id: 'dashboard', label: 'Home', to: '/team-lead', icon: LayoutDashboard },
      { id: 'queue', label: 'Queue', to: '/team-lead/queue', icon: Inbox },
      { id: 'review', label: 'Review', to: '/team-lead/review', icon: FileCheck },
      { id: 'submitted', label: 'Tasks', to: '/team-lead/submitted', icon: ScrollText },
      { id: 'team', label: 'Team', to: '/team-lead/team', icon: Users },
    ],
  },

  [UserRole.DESIGNER]: {
    label: 'Designer',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'tasks', label: 'My Tasks', to: '/designer', icon: ClipboardList },
          { id: 'submitted', label: 'Submitted', to: '/designer/submitted', icon: ScrollText },
          { id: 'analytics', label: 'My Analytics', to: '/designer/analytics', icon: Gauge },
        ],
      },
    ],
    mobile: [
      { id: 'tasks', label: 'Tasks', to: '/designer', icon: ClipboardList },
      { id: 'submitted', label: 'Done', to: '/designer/submitted', icon: ScrollText },
      { id: 'analytics', label: 'Stats', to: '/designer/analytics', icon: Gauge },
    ],
  },

  [UserRole.DIGITATOR]: {
    label: 'Digitizor',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'tasks', label: 'My Tasks', to: '/digitator', icon: ClipboardList },
          { id: 'submitted', label: 'Submitted', to: '/digitator/submitted', icon: ScrollText },
          { id: 'analytics', label: 'My Analytics', to: '/digitator/analytics', icon: Gauge },
        ],
      },
    ],
    mobile: [
      { id: 'tasks', label: 'Tasks', to: '/digitator', icon: ClipboardList },
      { id: 'submitted', label: 'Done', to: '/digitator/submitted', icon: ScrollText },
      { id: 'analytics', label: 'Stats', to: '/digitator/analytics', icon: Gauge },
    ],
  },

  [UserRole.SEWOUT]: {
    label: 'Sewout',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'tasks', label: 'My Tasks', to: '/sewout', icon: ClipboardList },
          { id: 'history', label: 'Sewout History', to: '/sewout/history', icon: ScrollText },
        ],
      },
    ],
    mobile: [
      { id: 'tasks', label: 'Tasks', to: '/sewout', icon: ClipboardList },
      { id: 'history', label: 'History', to: '/sewout/history', icon: ScrollText },
    ],
  },

  [UserRole.QC]: {
    label: 'QC Reviewer',
    sections: [
      {
        id: 'main',
        label: 'Main',
        items: [
          { id: 'queue', label: 'Review Queue', to: '/qc', icon: Inbox },
          { id: 'dashboard', label: 'QC Dashboard', to: '/qc/dashboard', icon: LayoutDashboard },
          { id: 'history', label: 'History', to: '/qc/history', icon: ScrollText },
        ],
      },
    ],
    mobile: [
      { id: 'queue', label: 'Queue', to: '/qc', icon: Inbox },
      { id: 'dashboard', label: 'Stats', to: '/qc/dashboard', icon: LayoutDashboard },
      { id: 'history', label: 'History', to: '/qc/history', icon: ScrollText },
    ],
  },

  [UserRole.ADMIN]: {
    label: 'Administration',
    sections: [
      {
        id: 'administration',
        label: 'Administration',
        items: [
          { id: 'dashboard', label: 'Admin Dashboard', to: '/admin', icon: LayoutDashboard },
          { id: 'new-jobs',    label: 'New Jobs',        to: '/admin/new-jobs',    icon: ScrollText },
          { id: 'new-quotes',  label: 'New Quotes',      to: '/admin/new-quotes',  icon: Inbox },
          { id: 'amendments',  label: 'Amendments',      to: '/admin/amendments',  icon: PencilRuler, badgeAccent: 'amber' },
          { id: 'email-inbox', label: 'Email Inbox',     to: '/admin/email-inbox', icon: Mail },
          { id: 'jobs',       label: 'All Jobs',         to: '/admin/jobs',        icon: ClipboardList },
          { id: 'clients',    label: 'Clients',          to: '/admin/clients',     icon: Users },
          { id: 'users',      label: 'User Management',  to: '/admin/users',       icon: ShieldCheck },
          { id: 'notifications', label: 'Notifications', to: '/admin/notifications', icon: Bell },
          // { id: 'reports',    label: 'Reports',          to: '/admin/reports',     icon: Gauge },
        ],
      },
      {
        id: 'create',
        label: 'Create',
        items: [
          { id: 'create-quote', label: 'New Quote',    to: '/admin/create-quote', icon: Sparkles },
          { id: 'place-order',  label: 'Place Order',  to: '/admin/place-order',  icon: Send },
        ],
      },
    ],
    mobile: [
      { id: 'dashboard', label: 'Home',    to: '/admin',          icon: LayoutDashboard },
      { id: 'new-jobs',  label: 'Jobs',    to: '/admin/new-jobs', icon: ScrollText },
      { id: 'clients',   label: 'Clients', to: '/admin/clients',  icon: Users },
      { id: 'users',     label: 'Users',   to: '/admin/users',    icon: ShieldCheck },
      // { id: 'reports',   label: 'Reports', to: '/admin/reports',  icon: Gauge },
    ],
  },
} as unknown as Record<UserRole, RoleNavConfig>;
