import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { UserRole } from '@contracts';
import { AuthLayout } from '@layouts/AuthLayout';
import { DashboardLayout } from '@layouts/DashboardLayout';
import { RoleGuard } from '@layouts/RoleGuard';
import { RootIndexRedirect } from '@layouts/RootIndexRedirect';

// Auth routes
import { LoginPage } from '@routes/auth/LoginPage';
import { RegisterPage } from '@routes/auth/RegisterPage';
import { ForgotPasswordPage } from '@routes/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@routes/auth/ResetPasswordPage';

// CS panel
import { CSDashboardPage } from '@routes/cs/CSDashboardPage';
import { CSNewQuotesPage } from '@routes/cs/CSNewQuotesPage';
import { CSNewJobsPage } from '@routes/cs/CSNewJobsPage';
import { CSProjectsPage } from '@routes/cs/CSProjectsPage';
import { CSQueuePage } from '@routes/cs/CSQueuePage';
import { CSDeliverPage } from '@routes/cs/CSDeliverPage';
import { CSAmendmentsPage } from '@routes/cs/CSAmendmentsPage';
import { CSCreateQuotePage } from '@routes/cs/CSCreateQuotePage';
import { CSPlaceOrderPage } from '@routes/cs/CSPlaceOrderPage';
import { CSClientsPage } from '@routes/cs/CSClientsPage';
import { CSProfilePage } from '@routes/cs/CSProfilePage';
import { CSEmailInboxPage } from '@routes/cs/CSEmailInboxPage';

// Team Lead
import { TeamLeadDashboardPage } from '@routes/team-lead/TeamLeadDashboardPage';
import { TeamLeadQueuePage } from '@routes/team-lead/TeamLeadQueuePage';
import { TeamLeadReviewPage } from '@routes/team-lead/TeamLeadReviewPage';
import { TeamLeadSubmittedPage } from '@routes/team-lead/TeamLeadSubmittedPage';
import { TeamLeadTeamPage } from '@routes/team-lead/TeamLeadTeamPage';

// Designer workspace
import { DesignerDashboardPage } from '@routes/designer/DesignerDashboardPage';
import { DesignerSubmittedPage } from '@routes/designer/DesignerSubmittedPage';
import { DesignerAnalyticsPage } from '@routes/designer/DesignerAnalyticsPage';

// Digitator workspace
import { DigitatorDashboardPage } from '@routes/digitator/DigitatorDashboardPage';
import { DigitatorSubmittedPage } from '@routes/digitator/DigitatorSubmittedPage';
import { DigitatorAnalyticsPage } from '@routes/digitator/DigitatorAnalyticsPage';

// Sewout workspace
import { SewoutDashboardPage } from '@routes/sewout/SewoutDashboardPage';
import { SewoutHistoryPage } from '@routes/sewout/SewoutHistoryPage';

// QC panel
import { QCDashboardPage } from '@routes/qc/QCDashboardPage';
import { QCStatsPage } from '@routes/qc/QCStatsPage';
import { QCHistoryPage } from '@routes/qc/QCHistoryPage';

// Admin panel
import { AdminDashboardPage } from '@routes/admin/AdminDashboardPage';
import { AdminJobsPage } from '@routes/admin/AdminJobsPage';
import { AdminJobDetailPage } from '@routes/admin/AdminJobDetailPage';
import { AdminNewJobsPage } from '@routes/admin/AdminNewJobsPage';
import { AdminNewQuotesPage } from '@routes/admin/AdminNewQuotesPage';
import { AdminClientsPage } from '@routes/admin/AdminClientsPage';
import { AdminUsersPage } from '@routes/admin/AdminUsersPage';
import { AdminEmailInboxPage } from '@routes/admin/AdminEmailInboxPage';
import { AdminNotificationsPage } from '@routes/admin/AdminNotificationsPage';
import { AdminCreateQuotePage } from '@routes/admin/AdminCreateQuotePage';
import { AdminPlaceOrderPage } from '@routes/admin/AdminPlaceOrderPage';
import { AdminReportsPage } from '@routes/admin/AdminReportsPage';
import { AdminSettingsPage } from '@routes/admin/AdminSettingsPage';
import { AdminProfilePage } from '@routes/admin/AdminProfilePage';

import { NotFoundPage } from '@routes/NotFoundPage';

/**
 * Router map. Role gating is enforced at the layout level via RoleGuard.
 * Inside a role namespace, all routes share the same DashboardLayout and
 * trust RoleGuard to redirect unauthorised access to the user's canonical
 * home.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootIndexRedirect />,
  },

  // Unauthenticated routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },

  // CS panel
  {
    path: '/cs',
    element: (
      <RoleGuard allow={[UserRole.CS, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <CSDashboardPage /> },
      { path: 'new-quotes', element: <CSNewQuotesPage /> },
      { path: 'new-jobs', element: <CSNewJobsPage /> },
      { path: 'projects', element: <CSProjectsPage /> },
      { path: 'queue', element: <CSQueuePage /> },
      { path: 'deliver', element: <CSDeliverPage /> },
      { path: 'amendments', element: <CSAmendmentsPage /> },
      { path: 'create-quote', element: <CSCreateQuotePage /> },
      { path: 'place-order', element: <CSPlaceOrderPage /> },
      { path: 'clients', element: <CSClientsPage /> },
      { path: 'email-inbox', element: <CSEmailInboxPage /> },
      { path: 'profile', element: <CSProfilePage /> },
    ],
  },

  // Team Lead
  {
    path: '/team-lead',
    element: (
      <RoleGuard allow={[UserRole.TEAM_LEAD, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <TeamLeadDashboardPage /> },
      { path: 'queue', element: <TeamLeadQueuePage /> },
      { path: 'review', element: <TeamLeadReviewPage /> },
      { path: 'submitted', element: <TeamLeadSubmittedPage /> },
      { path: 'team', element: <TeamLeadTeamPage /> },
    ],
  },

  // Designer workspace (Jr + Sr — distinguished by user.sub_type, not URL)
  {
    path: '/designer',
    element: (
      <RoleGuard allow={[UserRole.DESIGNER, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <DesignerDashboardPage /> },
      { path: 'submitted', element: <DesignerSubmittedPage /> },
      { path: 'analytics', element: <DesignerAnalyticsPage /> },
    ],
  },

  // Digitator workspace
  {
    path: '/digitator',
    element: (
      <RoleGuard allow={[UserRole.DIGITATOR, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <DigitatorDashboardPage /> },
      { path: 'submitted', element: <DigitatorSubmittedPage /> },
      { path: 'analytics', element: <DigitatorAnalyticsPage /> },
    ],
  },

  // Sewout workspace
  {
    path: '/sewout',
    element: (
      <RoleGuard allow={[UserRole.SEWOUT, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <SewoutDashboardPage /> },
      { path: 'history', element: <SewoutHistoryPage /> },
    ],
  },

  // QC panel — index is the review queue; /qc/dashboard is the stats view.
  {
    path: '/qc',
    element: (
      <RoleGuard allow={[UserRole.QC, UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <QCDashboardPage /> },
      { path: 'dashboard', element: <QCStatsPage /> },
      { path: 'history', element: <QCHistoryPage /> },
    ],
  },

  // Admin panel
  {
    path: '/admin',
    element: (
      <RoleGuard allow={[UserRole.ADMIN]}>
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </RoleGuard>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'jobs', element: <AdminJobsPage /> },
      { path: 'jobs/:jobCardId', element: <AdminJobDetailPage /> },
      { path: 'new-jobs', element: <AdminNewJobsPage /> },
      { path: 'new-quotes', element: <AdminNewQuotesPage /> },
      { path: 'clients', element: <AdminClientsPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'email-inbox', element: <AdminEmailInboxPage /> },
      { path: 'notifications', element: <AdminNotificationsPage /> },
      { path: 'amendments', element: <CSAmendmentsPage /> },
      { path: 'create-quote', element: <AdminCreateQuotePage /> },
      { path: 'place-order', element: <AdminPlaceOrderPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'profile', element: <AdminProfilePage /> },
    ],
  },

  // 404
  { path: '*', element: <NotFoundPage /> },
]);

/**
 * Map each role to its canonical home route. Used by RoleGuard and
 * RootIndexRedirect to send users to "their" dashboard after login or
 * after hitting a route outside their permission set.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.CLIENT]: '/login',
  [UserRole.CS]: '/cs',
  [UserRole.TEAM_LEAD]: '/team-lead',
  [UserRole.DESIGNER]: '/designer',
  [UserRole.DIGITATOR]: '/digitator',
  [UserRole.SEWOUT]: '/sewout',
  [UserRole.QC]: '/qc',
  [UserRole.ADMIN]: '/admin',
};

/** Convenience helper for `<Navigate to={pathForRole(role)} />`. */
export function pathForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

// Re-exported for tests that need to grab a route by accident-free constants.
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  CS: '/cs',
  TEAM_LEAD: '/team-lead',
  DESIGNER: '/designer',
  DIGITATOR: '/digitator',
  SEWOUT: '/sewout',
  QC: '/qc',
  ADMIN: '/admin',
} as const;

// Silences unused-import warning during initial scaffold while Navigate is
// reserved for upcoming route guards inside per-role children.
void Navigate;
