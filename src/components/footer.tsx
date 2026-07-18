/**
 * Minimal SaaS-style footer — a single quiet copyright line separated from the
 * page by a 1px hairline. No logo, no names, no animation or decoration.
 * Rendered once in the root layout.
 */
export function Footer() {
  return (
    <footer className="no-print mt-auto w-full border-t border-white/10 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-5 text-center">
        <p className="text-xs text-muted">© 2026 STME. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
