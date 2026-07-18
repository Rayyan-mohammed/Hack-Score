import { cn } from "@/lib/utils";

/**
 * Brand mark — the STME crest alone (no wordmark).
 *
 * The supplied logo is dark ink on transparent, so on the dark navbar it needs
 * a light backing to be legible; it sits on a small white chip rather than
 * floating as an invisible smudge. object-contain keeps the 3.1:1 crest
 * undistorted at any height.
 *
 * size="md" — navbar/shell: h-11 on mobile, h-14 on desktop.
 * size="lg" — standalone auth screen: a touch larger, still logo-only.
 *
 * Note: the crest is ~3.1:1, so h-14 (~174px wide + chip) is near the widest
 * the 240px sidebar can hold without clipping — don't grow past this here
 * without also widening the sidebar.
 */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const logoHeight = size === "lg" ? "h-12 sm:h-14" : "h-11 md:h-14";

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
