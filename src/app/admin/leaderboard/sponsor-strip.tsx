import type { Sponsor } from "../hackathons/sponsors-manager";

/**
 * Sponsor strip for the leaderboard. Sponsors arrive sorted by sort_order, so
 * #1 gets the title-sponsor treatment (larger, on its own line) and the rest
 * sit in a smaller row beneath. Renders nothing when there are no sponsors.
 *
 * Logos sit on a fixed-height white chip with object-contain, so wildly
 * different aspect ratios never shift the layout and dark logos stay visible
 * on the dark theme. The sponsor name is the alt text, so a broken or slow
 * image still reads correctly.
 */
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  const [title, ...rest] = sponsors;

  return (
    <section
      aria-label="Sponsors"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      {/* Title sponsor */}
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {title.label}
        </p>
        <span className="mt-2 inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={title.logo_url}
            alt={title.name}
            className="h-14 w-auto max-w-[220px] object-contain"
          />
        </span>
        <p className="mt-2 font-display text-sm font-semibold text-foreground">
          {title.name}
        </p>
      </div>

      {/* Remaining sponsors */}
      {rest.length > 0 && (
        <div className="mt-5 flex flex-wrap items-start justify-center gap-x-6 gap-y-4 border-t border-border pt-5">
          {rest.map((s) => (
            <div key={s.id} className="text-center">
              <p className="text-[11px] tracking-wide text-subtle uppercase">
                {s.label}
              </p>
              <span className="mt-1.5 inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-2 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.logo_url}
                  alt={s.name}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              </span>
              <p className="mt-1.5 text-xs text-muted">{s.name}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
