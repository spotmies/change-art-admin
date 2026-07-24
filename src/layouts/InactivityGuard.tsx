/**
 * InactivityGuard
 *
 * Automatically signs out ADMIN and CS users after TIMEOUT_MS of inactivity.
 * A warning dialog appears at WARN_BEFORE_MS remaining so the user can stay.
 *
 * Strategy
 * ─────────
 * • Activity events (mouse, keyboard, scroll, touch) push the deadline
 *   forward in a ref — no re-renders on every mousemove.
 * • A setInterval checks remaining time every second for the countdown UI.
 * • document.visibilitychange fires immediately when a background tab is
 *   re-focused so we catch sessions that expired while the tab was hidden.
 * • Sign-out is guarded by a ref flag so it can never fire twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, LogOut } from 'lucide-react';
import { UserRole } from '@contracts';
import { useSessionUser, useAuthStore } from '@modules/auth/stores/auth-store';
import { authService } from '@modules/auth/services';

const TIMEOUT_MS     = 15 * 60 * 1000;   // 15 min inactivity → sign out
const WARN_BEFORE_MS =  2 * 60 * 1000;   // show warning when 2 min remain
const TICK_MS        =  1_000;            // UI refresh interval

const TIMED_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.CS]);

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export function InactivityGuard() {
  const user       = useSessionUser();
  const resetStore = useAuthStore((s) => s.reset);
  const navigate   = useNavigate();

  const enabled = !!user && TIMED_ROLES.has(user.role as UserRole);

  // --- mutable refs (no re-render side-effects) ----------------------------
  const deadlineRef   = useRef(Date.now() + TIMEOUT_MS);
  const signedOutRef  = useRef(false);

  // Latest version of the sign-out action (avoids stale closure in effects).
  const signOutActionRef = useRef<() => Promise<void>>(async () => {});

  // --- reactive state (drives UI) ------------------------------------------
  const [msLeft,      setMsLeft]      = useState(TIMEOUT_MS);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Keep the sign-out action current on every render.
  signOutActionRef.current = async () => {
    if (signedOutRef.current) return;
    signedOutRef.current = true;
    setIsSigningOut(true);

    try {
      await authService.signOut();
    } catch {
      // Server session may already be expired — clear local state regardless.
    }

    resetStore();
    // Toast lives at App level and persists through navigation.
    toast.error('Your session expired due to inactivity. Please sign in again.', {
      duration: 7_000,
    });
    navigate('/login', { replace: true });
  };

  // Helper used by both the auto-timeout and the "Sign Out" button.
  const triggerSignOut = useCallback(() => {
    void signOutActionRef.current();
  }, []);

  // "Stay signed in" — reset deadline immediately (no 1-second delay).
  const handleStaySignedIn = useCallback(() => {
    deadlineRef.current = Date.now() + TIMEOUT_MS;
    signedOutRef.current = false;
    setMsLeft(TIMEOUT_MS);
  }, []);

  // -------------------------------------------------------------------------
  // Set up activity listeners + Page Visibility check when guard is active.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    // Seed the deadline fresh whenever the guard activates.
    deadlineRef.current  = Date.now() + TIMEOUT_MS;
    signedOutRef.current = false;

    function onActivity() {
      // Only extend if we haven't already started signing out.
      if (!signedOutRef.current) {
        deadlineRef.current = Date.now() + TIMEOUT_MS;
      }
    }

    // When the user returns to a hidden tab, immediately evaluate whether
    // the deadline passed while they were away and sign out if so.
    function onVisibilityChange() {
      if (document.hidden) return;
      if (signedOutRef.current) return;
      if (Date.now() >= deadlineRef.current) {
        void signOutActionRef.current();
      }
    }

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivity),
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]);

  // -------------------------------------------------------------------------
  // Countdown interval — updates `msLeft` every second.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      if (signedOutRef.current) return;

      const remaining = deadlineRef.current - Date.now();

      if (remaining <= 0) {
        setMsLeft(0);
        // Trigger sign-out directly here so it fires even if the effect
        // below doesn't re-run (e.g. React batches the setMsLeft call).
        void signOutActionRef.current();
      } else {
        setMsLeft(remaining);
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [enabled]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------
  const showWarning = enabled && !isSigningOut && msLeft > 0 && msLeft <= WARN_BEFORE_MS;

  if (!showWarning) return null;

  const totalSecs = Math.ceil(msLeft / 1000);
  const mm        = Math.floor(totalSecs / 60);
  const ss        = totalSecs % 60;
  const countdown = `${mm}:${String(ss).padStart(2, '0')}`;
  const urgent    = totalSecs <= 30;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: 'var(--glass-bg)',
          border: `1px solid ${urgent ? 'var(--color-crimson)' : 'var(--glass-border)'}`,
          borderRadius: 16,
          padding: '36px 28px 28px',
          maxWidth: 400,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
          transition: 'border-color 0.3s',
        }}
      >
        {/* Clock icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Clock
            style={{
              width: 44,
              height: 44,
              color: urgent ? 'var(--color-crimson)' : 'var(--color-amber)',
              transition: 'color 0.3s',
            }}
            aria-hidden
          />
        </div>

        <h2
          id="inactivity-title"
          style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}
        >
          Session Expiring Soon
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
          You've been inactive for a while. To protect your account,
          you'll be signed out automatically in:
        </p>

        {/* Countdown */}
        <div
          aria-live="polite"
          aria-label={`${countdown} remaining`}
          style={{
            fontSize: 52,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em',
            color: urgent ? 'var(--color-crimson)' : 'var(--color-amber)',
            marginBottom: 32,
            transition: 'color 0.3s',
          }}
        >
          {countdown}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={triggerSignOut}
          >
            <LogOut style={{ width: 14, height: 14 }} aria-hidden />
            Sign Out
          </button>
          <button
            type="button"
            className="btn btn-crimson"
            style={{ flex: 1 }}
            onClick={handleStaySignedIn}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
