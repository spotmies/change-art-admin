/**
 * Public surface for the shared-ui module — every cross-module UI primitive
 * is re-exported here. Modules MUST import from `@modules/shared-ui` and
 * never reach into `@modules/shared-ui/components/*` directly.
 */

// Layout / chrome
export { Sidebar } from './components/Sidebar';
export { Topbar } from './components/Topbar';
export { MobileBottomNav } from './components/MobileBottomNav';
export { NotificationBell } from './components/NotificationBell';
export { ConfirmModal } from './components/ConfirmModal';
export { RowActionsMenu } from './components/RowActionsMenu';
export type { RowAction } from './components/RowActionsMenu';

// Badges
export { StatusBadge, PriorityBadge } from './components/StatusBadge';

// Page primitives — ported from change_artwork_demo_v2.html
export { GreetingHero } from './components/GreetingHero';
export { StatCard, StatGrid } from './components/StatCard';
export type { StatCardProps, StatAccent } from './components/StatCard';
export { Panel, SectionHeader } from './components/Panel';
export { Callout } from './components/Callout';
export type { CalloutTone } from './components/Callout';
export { Pills } from './components/Pills';
export type { PillItem } from './components/Pills';
export { Pagination } from './components/Pagination';
export { JobTable } from './components/JobTable';
export { JobFilterBar, applyJobFilters, EMPTY_FILTERS, JOB_STATUS_OPTIONS, QUOTE_STATUS_OPTIONS } from './components/JobFilterBar';
export type { JobFilters } from './components/JobFilterBar';
export { JobModal } from './components/JobModal';
export { MiniBars } from './components/MiniBars';
export type { MiniBarsItem } from './components/MiniBars';
export { DonutChart } from './components/DonutChart';
export type { DonutSlice } from './components/DonutChart';
export { BarChart } from './components/BarChart';
export type { BarChartItem } from './components/BarChart';
export { CreateJobForm } from './components/CreateJobForm';
export { ClientBriefForm } from './components/ClientBriefForm';
export { AdminBriefForm } from './components/AdminBriefForm';
export type { ClientBriefData } from './components/AdminBriefForm';
export { JobDetailModal } from './components/JobDetailModal';
export { EditJobModal } from './components/EditJobModal';
export type { EditFields } from './components/EditJobModal';
export { RequestModificationModal } from './components/RequestModificationModal';

// Nav config
export { NAV_CONFIG } from './nav-config';
export type { NavBadgeAccent, NavItem, NavSection, RoleNavConfig } from './nav-config';

// Mocks
export * from './mocks';
