import { cn } from "@/lib/utils";

/**
 * Brand mark — the NMIMS / STME lockup.
 *
 * The logo is dark ink on transparent, so on the dark navbar it needs a light
 * backing to be legible; it sits on a small white chip. The chip uses
 * `logo-tight.png`, a copy of `logo.png` cropped to the ink (the original
 * carries ~12% empty margin on every side, which made the chip mostly white
 * with a small logo in the middle). `logo.png` itself is left as-is — the
 * official report letterhead uses it.
 *
 * size="md" — navbar/shell: h-12 on mobile, 60px on desktop.
 * size="lg" — standalone auth screen: a touch larger.
 *
 * The cropped lockup is ~3:1, so 60px tall (~180px wide + chip padding) is
 * near the widest the 240px sidebar can hold — don't grow past this here
 * without also widening the sidebar.
 */
export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const logoHeight = size === "lg" ? "h-14 sm:h-16" : "h-12 md:h-[3.75rem]";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md bg-white px-1.5 py-1 ring-1 ring-white/10",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-tight.png"
        alt="NMIMS — School of Technology Management & Engineering, Hyderabad Campus"
        className={cn("w-auto max-w-full object-contain", logoHeight)}
      />
    </span>
  );
}
