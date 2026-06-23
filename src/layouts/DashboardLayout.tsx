import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sidebar } from '@modules/shared-ui/components/Sidebar';
import { Topbar } from '@modules/shared-ui/components/Topbar';
import { MobileBottomNav } from '@modules/shared-ui/components/MobileBottomNav';
import { useSessionUser } from '@modules/auth/stores/auth-store';
import { NAV_CONFIG } from '@modules/shared-ui/nav-config';
import { UserRole } from '@contracts';
import { useAdminJobById } from '@modules/admin-panel/hooks/use-admin-jobs';
import { JobDetailModal, EditJobModal, type Job } from '@modules/shared-ui';

interface DashboardLayoutProps {
  children: ReactNode;
}

/** Reads `?open=<uuid>` from the URL and opens that job's detail modal directly globally. */
function DeepLinkModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open') ?? '';
  const { data: job } = useAdminJobById(openId);
  const [editJob, setEditJob] = useState<Job | null>(null);

  return (
    <>
      <JobDetailModal
        job={openId && job ? job : null}
        onClose={() => setSearchParams((p) => { p.delete('open'); return p; })}
        onEdit={(j) => setEditJob(j)}
        onAssign={() => setSearchParams((p) => { p.delete('open'); return p; })}
      />
      {editJob && (
        <EditJobModal
          job={editJob}
          onClose={() => setEditJob(null)}
          onBack={() => setEditJob(null)}
        />
      )}
    </>
  );
}

/**
 * The authenticated shell: sidebar (slide-out on mobile) + topbar +
 * scrollable content + mobile bottom nav. Resolves the current page's
 * title by matching the active route against the role's NAV_CONFIG.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const user = useSessionUser();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    toast.dismiss();
  }, [location.pathname]);

  const closeMobile = useCallback(() => setMobileNavOpen(false), []);
  const openMobile = useCallback(() => setMobileNavOpen(true), []);

  const title = pageTitleFromRoute(user?.role, location.pathname);
  const resolvedSubtitle = title.subtitle?.replace('{user.name}', user?.name || '');

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar collapsedOnMobile={!mobileNavOpen} onNavigateMobile={closeMobile} />

      {/* Mobile overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="md:hidden fixed inset-0 z-30 bg-black/40 anim-fade-in"
          onClick={closeMobile}
        />
      ) : null}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col md:ml-[var(--sidebar-w)]">
        <Topbar title={title.title} subtitle={resolvedSubtitle} onOpenMobileNav={openMobile} />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 md:px-6 py-[22px] pb-[calc(var(--mobile-nav-h)+1rem)] md:pb-[22px] anim-fade-in"
          tabIndex={-1}
        >
          {children}
        </main>

        <MobileBottomNav />
      </div>

      <DeepLinkModal />
    </div>
  );
}

function pageTitleFromRoute(
  role: UserRole | undefined,
  pathname: string,
): { title: string; subtitle?: string } {
  if (!role) return { title: 'Dashboard' };
  const cfg = NAV_CONFIG[role];
  for (const section of cfg.sections) {
    const match = section.items.find((it) => it.to === pathname);
    if (match) {
      return { title: match.label, subtitle: match.subtitle || cfg.label };
    }
  }
  return { title: cfg.label };
}
