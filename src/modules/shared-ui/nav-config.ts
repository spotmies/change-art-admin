import {
  ClipboardList,
  Cog,
  FileCheck,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
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

export type NavBadgeAccent = 'crimson' | 'amber' | 'green' | 'navy' | 'red' | 'blue' | 'purple' | 'orange' | 'teal';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  badgeAccent?: NavBadgeAccent;
  subtitle?: string;
  /** Distinct display title for the topbar header — falls back to `label` (which stays short for the sidebar link). */
  title?: string;
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
        label: 'Client Service',
        items: [
          {
            id: 'dashboard',
            label: 'Dashboard',
            to: '/cs',
            icon: LayoutDashboard,
            title: 'Client Service Dashboard',
            subtitle: "Good {greeting}, {user.name}! Here's what needs your attention today.",
          },
          { id: 'new-jobs', label: 'New Requests', to: '/cs/new-jobs', icon: Inbox, badgeAccent: 'red' },
          { id: 'live', label: 'Live (Direct)', to: '/cs/projects?project=Live', icon: FileText, badgeAccent: 'green' },
          { id: 'live-quote', label: 'Live Quote', to: '/cs/projects?project=Live+Quote', icon: MessageSquare, badgeAccent: 'blue' },
          { id: 'quote', label: 'Quote', to: '/cs/new-quotes', icon: FileText, badgeAccent: 'purple' },
          { id: 'amend', label: 'Amend', to: '/cs/amendments', icon: PencilRuler, badgeAccent: 'orange' },
          { id: 'in-production', label: 'In Production', to: '/cs/projects?filter=In+Production', icon: Cog, badgeAccent: 'amber' },
          { id: 'deliver', label: 'Ready to Dispatch', to: '/cs/deliver', icon: Truck, badgeAccent: 'teal' },
          { id: 'projects', label: 'All Projects', to: '/cs/projects', icon: ClipboardList },
          { id: 'email-inbox', label: 'Email Inbox', to: '/cs/email-inbox', icon: Mail, badgeAccent: 'red' },
          { id: 'queue', label: 'Job Queue', to: '/cs/queue', icon: Gauge },
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
          {
            id: 'dashboard',
            label: 'Dashboard',
            to: '/admin',
            icon: LayoutDashboard,
            title: 'Admin Dashboard',
            subtitle: "Good {greeting}, {user.name}! Platform-wide overview across all modules.",
          },
          { id: 'new-jobs',     label: 'New Requests',     to: '/admin/new-jobs',                      icon: ScrollText, badgeAccent: 'red' },
          { id: 'live',         label: 'Live (Direct)',    to: '/admin/projects?project=Live',          icon: FileText, badgeAccent: 'green' },
          { id: 'live-quote',   label: 'Live Quote',       to: '/admin/projects?project=Live+Quote',    icon: MessageSquare, badgeAccent: 'blue' },
          { id: 'new-quotes',   label: 'Quote',            to: '/admin/new-quotes',                     icon: Inbox, badgeAccent: 'purple' },
          { id: 'amendments',   label: 'Amend',            to: '/admin/amendments',                     icon: PencilRuler, badgeAccent: 'orange' },
          { id: 'in-production', label: 'In Production',   to: '/admin/jobs?filter=In+Production',      icon: Cog, badgeAccent: 'amber' },
          { id: 'deliver',      label: 'Ready to Dispatch', to: '/admin/deliver',                       icon: Truck, badgeAccent: 'teal' },
          { id: 'projects',     label: 'All Projects',     to: '/admin/projects',                       icon: ClipboardList },
          { id: 'email-inbox',  label: 'Email Inbox',      to: '/admin/email-inbox',                    icon: Mail, badgeAccent: 'red' },
          { id: 'queue',        label: 'Job Queue',        to: '/admin/queue',                          icon: Gauge },
          { id: 'users',        label: 'User Management',  to: '/admin/users',                          icon: ShieldCheck },
        ],
      },
      {
        id: 'create',
        label: 'Create',
        items: [
          { id: 'create-quote', label: 'Create Quote', to: '/admin/create-quote', icon: Sparkles },
          { id: 'place-order',  label: 'Place Order',  to: '/admin/place-order',  icon: Send },
        ],
      },
      {
        id: 'records',
        label: 'Records',
        items: [{ id: 'clients', label: 'Client Records', to: '/admin/clients', icon: Users }],
      },
    ],
    mobile: [
      { id: 'dashboard', label: 'Home',    to: '/admin',          icon: LayoutDashboard },
      { id: 'new-jobs',  label: 'Jobs',    to: '/admin/new-jobs', icon: ScrollText },
      { id: 'clients',   label: 'Clients', to: '/admin/clients',  icon: Users },
      { id: 'users',     label: 'Users',   to: '/admin/users',    icon: ShieldCheck },
    ],
  },
} as unknown as Record<UserRole, RoleNavConfig>;
