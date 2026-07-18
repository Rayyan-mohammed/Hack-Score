import { cn } from "@/lib/utils";

const CRAFTED_BY = ["MD Rayyan", "Mounika", "Lahari", "Krishna"];

/**
 * Site footer with two variants that share the same copyright styling:
 *  - "minimal" (default): a single muted copyright line. Used app-wide.
 *  - "full": adds a "Crafted by" credit above the copyright. Used on the
 *    auth screens only.
 */
export function Footer({
  variant = "minimal",
}: {
  variant?: "minimal" | "full";
}) {
  return (
    <footer className="no-print mt-auto w-full border-t border-white/10 bg-background">
      <div
        className={cn(
          "mx-auto max-w-6xl px-4 text-center",
          variant === "full" ? "py-6" : "py-5",
        )}
      >
        {variant === "full" && (
          <div className="mb-4">
            <p className="text-xs text-muted">Crafted by</p>
            <ul className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
              {CRAFTED_BY.map((name, i) => (
                <li key={name} className="flex items-center gap-x-2.5">
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
          </div>
        )}

        <p className="text-xs text-muted">© 2026 STME. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
