import { cn } from "@/lib/utils";

/** Accent-gradient progress bar with an accessible role. */
export function ProgressBar({
  value,
  label,
  className,
}: {
  /** 0–100 */
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-raised",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-accent transition-[width] duration-500 ease-out"
        // Dynamic width is the one value that cannot be a static utility class.
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
