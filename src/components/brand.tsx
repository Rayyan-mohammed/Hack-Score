import { cn } from "@/lib/utils";

/**
 * Brand mark — the STME crest alone (no wordmark).
 *
 * The supplied logo is dark ink on transparent, so on the dark navbar it needs
 * a light backing to be legible; it sits on a small white chip rather than
 * floating as an invisible smudge. object-contain keeps the 3.1:1 crest
 * undistorted at any height.
 *
 * size="md" — navbar/shell: h-7 on mobile, h-8 on desktop (per spec).
 * size="lg" — standalone auth screen: slightly larger, still logo-only.
 */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const logoHeight = size === "lg" ? "h-9" : "h-7 md:h-8";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md bg-white px-2 py-1 ring-1 ring-white/10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="STME — School of Technology Management & Engineering"
        className={cn("w-auto max-w-full object-contain", logoHeight)}
      />
    </span>
  );
}
