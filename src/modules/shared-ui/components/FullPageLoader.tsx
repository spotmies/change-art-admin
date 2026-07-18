/**
 * Full-viewport loading state shown while the session bootstrap is in
 * flight. Renders the brand mark (same asset + treatment as the sidebar)
 * rather than a generic spinner card, so the transient state reads as part
 * of the product loading in, not an error/empty-state box.
 */
export function FullPageLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-navy"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="anim-fade-in flex flex-col items-center gap-3">
        <img
          src="/ch-logo.png"
          alt=""
          aria-hidden="true"
          className="anim-pulse h-9 w-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
          draggable={false}
        />
        <div className="flex h-[3px] w-[138px] rounded-[2px] overflow-hidden">
          <div style={{ flex: '0 0 45%', background: 'var(--color-crimson)' }} />
          <div style={{ flex: '0 0 30%', background: '#ffffff' }} />
          <div style={{ flex: '0 0 25%', background: '#1e3a5f' }} />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
