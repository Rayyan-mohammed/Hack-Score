const CRAFTED_BY = ["MD Rayyan", "Mounika", "Lahari", "Krishna"];

export function Footer() {
  return (
    <footer className="no-print relative mt-auto w-full bg-background">
      {/* Accent gradient hairline separating the footer from page content */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-line opacity-70"
      />

      <div className="reveal-on-view mx-auto max-w-5xl px-4 py-10 text-center">
        {/* The supplied logo is dark ink on white, so it sits on an explicit
            white chip — otherwise it reads as a bare rectangle on the dark page. */}
        <span className="mx-auto mb-4 inline-flex rounded-xl bg-white px-3 py-2 shadow-card ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STME Club Logo" className="h-10 w-auto" />
        </span>

        <p className="text-xs text-muted">Crafted by</p>

        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {CRAFTED_BY.map((name, i) => (
            <li key={name} className="flex items-center gap-x-3">
              <span className="font-display text-sm font-semibold text-gradient-accent transition-[filter] duration-200 hover:drop-shadow-[0_0_10px_rgba(124,58,237,0.65)]">
                {name}
              </span>
              {i < CRAFTED_BY.length - 1 && (
                <span aria-hidden="true" className="text-subtle">
                  •
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted">
          © 2026 STME. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
